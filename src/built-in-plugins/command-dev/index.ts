import { exec, execSync, fork } from "child_process"
import * as colors from "colors"
import * as fs from "fs-extra"
import * as open from "opn"
import * as path from "path"
import * as portfinder from "portfinder"
import * as webpack from "webpack"
import * as webpackDevServer from "webpack-dev-server"
import { pri } from "../../node"
import { analyseProject } from "../../utils/analyse-project"
import { createEntry } from "../../utils/create-entry"
import { ensureFiles } from "../../utils/ensure-files"
import { log, spinner } from "../../utils/log"
import { findNearestNodemodulesFile } from "../../utils/npm-finder"
import { getConfig } from "../../utils/project-config"
import { IProjectConfig } from "../../utils/project-config-interface"
import { tempJsEntryPath, tempPath } from "../../utils/structor-config"
import text from "../../utils/text"

const projectRootPath = process.cwd()
const dllFileName = "main.dll.js"
const dllMainfestName = "mainfest.json"
const dllOutPath = path.join(projectRootPath, ".temp/static/dlls")
const libraryStaticPath = "/dlls/" + dllFileName

export const CommandDev = async () => {
  const env = "local"
  const projectConfig = getConfig(projectRootPath, env)

  await spinner("Ensure project files", async () => {
    ensureFiles(projectRootPath, projectConfig, false)
  })

  await spinner("Analyse project", async () => {
    await analyseProject(projectRootPath, env, projectConfig)
    createEntry(projectRootPath, env, projectConfig)
  })

  log(colors.blue("\nCreate dlls\n"))

  execSync(
    [
      `${findNearestNodemodulesFile("/.bin/webpack")}`,
      `--mode development`,
      `--progress`,
      `--config ${path.join(__dirname, "./webpack.dll.config.js")}`,
      `--env.projectRootPath ${projectRootPath}`,
      `--env.dllOutPath ${dllOutPath}`,
      `--env.dllFileName ${dllFileName}`,
      `--env.dllMainfestName ${dllMainfestName}`
    ].join(" "),
    {
      stdio: "inherit"
    }
  )

  log(colors.blue("\nStart dev server.\n"))

  const freePort = await portfinder.getPortPromise()
  const dashboardServerPort = await portfinder.getPortPromise({
    port: freePort + 1
  })
  const dashboardClientPort = await portfinder.getPortPromise({
    port: freePort + 2
  })

  // Start dashboard server
  fork(path.join(__dirname, "dashboard/server/index.js"), [
    "--serverPort",
    dashboardServerPort.toString(),
    "--projectRootPath",
    projectRootPath,
    "--env",
    env
  ])

  // If has dashboard bundle, run project with dashboard prod in iframe.
  // If has't dashboard bundle, run dashboard dev server only.
  const dashboardBundleRootPath = path.join(__dirname, "../../bundle")
  const dashboardBundleFileName = "main"
  const hasDashboardBundle = fs.existsSync(path.join(dashboardBundleRootPath, dashboardBundleFileName + ".js"))

  if (hasDashboardBundle) {
    if (projectConfig.useHttps) {
      log(`you should set chrome://flags/#allow-insecure-localhost, to trust local certificate.`)
    }

    // Start dashboard client production server
    fork(path.join(__dirname, "dashboard/server/client-server.js"), [
      "--serverPort",
      dashboardServerPort.toString(),
      "--clientPort",
      dashboardClientPort.toString(),
      "--projectRootPath",
      projectRootPath,
      "--dashboardBundleRootPath",
      dashboardBundleRootPath,
      "--dashboardBundleFileName",
      dashboardBundleFileName
    ])

    // Serve project
    execSync(
      [
        `${findNearestNodemodulesFile("/.bin/webpack-dev-server")}`,
        `--mode development`,
        `--progress`,
        `--hot`,
        `--hotOnly`,
        `--config ${path.join(__dirname, "../../utils/webpack-config.js")}`,
        `--env.projectRootPath ${projectRootPath}`,
        `--env.env ${env}`,
        `--env.publicPath /static/`,
        `--env.entryPath ${path.join(projectRootPath, path.format(tempJsEntryPath))}`,
        `--env.devServerPort ${freePort}`,
        `--env.htmlTemplatePath ${path.join(__dirname, "../../../template-project.ejs")}`,
        `--env.htmlTemplateArgs.dashboardServerPort ${dashboardServerPort}`,
        `--env.htmlTemplateArgs.dashboardClientPort ${dashboardClientPort}`,
        `--env.htmlTemplateArgs.libraryStaticPath ${libraryStaticPath}`
      ].join(" "),
      {
        stdio: "inherit"
      }
    )
  } else {
    // Serve dashboard only
    execSync(
      [
        `${findNearestNodemodulesFile("/.bin/webpack-dev-server")}`,
        `--mode development`,
        `--progress`,
        `--hot`,
        `--hotOnly`,
        `--config ${path.join(__dirname, "../../utils/webpack-config.js")}`,
        `--env.projectRootPath ${__dirname}`,
        `--env.env ${env}`,
        `--env.publicPath /static/`,
        `--env.entryPath ${path.join(__dirname, "dashboard/client/index.js")}`,
        `--env.distFileName main`,
        `--env.devServerPort ${dashboardClientPort}`,
        `--env.htmlTemplatePath ${path.join(__dirname, "../../../template-dashboard.ejs")}`,
        `--env.htmlTemplateArgs.dashboardServerPort ${dashboardServerPort}`
      ].join(" "),
      {
        stdio: "inherit"
      }
    )
  }
}

export default (instance: typeof pri) => {
  instance.build.pipeConfig((env, config) => {
    if (env !== "local") {
      return config
    }

    config.plugins.push(
      new webpack.DllReferencePlugin({
        context: ".",
        manifest: require(path.join(dllOutPath, dllMainfestName))
      })
    )

    return config
  })

  instance.project.onCreateEntry((analyseInfo, entry, env, projectConfig) => {
    if (env === "local") {
      entry.pipeHeader(header => {
        return `
          ${header}
          import { hot } from "react-hot-loader"
          setEnvLocal()
        `
      })

      // Redirect to basename
      if (projectConfig.baseHref !== "/") {
        entry.pipeBody(body => {
          return `
            ${body}
            if (location.pathname === "/") {
              customHistory.push("/")
            }
          `
        })
      }

      // Set custom env
      if (projectConfig.customEnv) {
        entry.pipeBody(body => {
          return `
            ${body}
            setCustomEnv(${JSON.stringify(projectConfig.customEnv)})
          `
        })
      }

      // Jump page from iframe dashboard event.
      entry.pipeEntryClassBody(entryClassBody => {
        return `
        ${entryClassBody}
          public componentWillMount() {
            window.addEventListener("message", event => {
              const data = event.data
              switch(data.type) {
                case "changeRoute":
                  customHistory.push(data.path)
                  break
                default:
              }
            }, false)
          }
      `
      })

      // React hot loader
      entry.pipeFooter(footer => {
        return `
          const HotRoot = hot(module)(Root)

          ReactDOM.render(
            <HotRoot />,
            document.getElementById("root")
          )
          `
      })
    }
  })

  instance.commands.registerCommand({
    name: "dev",
    description: text.commander.dev.description,
    action: CommandDev,
    isDefault: true
  })
}

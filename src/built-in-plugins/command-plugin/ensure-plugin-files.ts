import * as fs from "fs-extra"
import * as path from "path"
import * as prettier from "prettier"

export function ensureGitignore(projectRootPath: string) {
  const filePath = path.join(projectRootPath, ".gitignore")
  const ensureContents = ["node_modules", ".cache", ".vscode", ".temp"]

  const exitFileContent = fs.existsSync(filePath) ? fs.readFileSync(filePath).toString() || "" : ""
  const exitFileContentArray = exitFileContent.split("\n").filter(content => content !== "")

  ensureContents.forEach(content => {
    if (exitFileContentArray.indexOf(content) === -1) {
      exitFileContentArray.push(content)
    }
  })

  fs.writeFileSync(filePath, exitFileContentArray.join("\n"))
}

export function ensurePackageJson(projectRootPath: string) {
  const filePath = path.join(projectRootPath, "package.json")

  fs.writeFileSync(
    filePath,
    JSON.stringify(
      {
        name: "pri-plugin-",
        version: "0.0.0",
        types: "src/index.ts",
        main: "built/index.js",
        scripts: {
          start: "tsc -w"
        },
        dependencies: {
          pri: "*",
          "@types/node": "*"
        }
      },
      null,
      2
    )
  )
}

export function ensureEntry(projectRootPath: string) {
  const filePath = path.join(projectRootPath, "src/index.tsx")

  fs.outputFileSync(
    filePath,
    prettier.format(
      `
    import * as path from "path"
    import { pri } from "pri"

    interface IResult {
      customPlugin: {
        hasComponents: boolean
      }
    }

    export default (instance: typeof pri) => {
      const projectRootPath = instance.project.getProjectRootPath()

      instance.commands.registerCommand({
        name: "deploy",
        action: () => {
          //
        }
      })

      instance.commands.expandCommand({
        name: "init",
        beforeAction: (...args: any[]) => {
          //
        }
      })

      instance.project.onAnalyseProject(files => {
        return {
          customPlugin: {
            hasComponents: files
              .some(file => {
                const relativePath = path.relative(projectRootPath, path.join(file.dir, file.name))
                if (relativePath.startsWith("src/components")) {
                  return true
                }
                return false
              })
          }
        } as IResult
      })

      instance.project.onCreateEntry((analyseInfo: IResult, entry, env, projectConfig) => {
        if (!analyseInfo.customPlugin.hasComponents) {
          return
        }

        entry.pipeHeader(header => {
          return \`
            \${header}
            import "src/components/xxx"
          )} "
          \`
        })
      })
    }
  `,
      {
        semi: false,
        parser: "typescript"
      }
    )
  )
}

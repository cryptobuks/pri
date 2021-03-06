import * as koaCors from "@koa/cors"
import * as chokidar from "chokidar"
import * as fs from "fs"
import * as http from "http"
import * as https from "https"
import * as Koa from "koa"
import * as koaCompress from "koa-compress"
import * as koaMount from "koa-mount"
import * as koaStatic from "koa-static"
import * as path from "path"
import * as socketIo from "socket.io"
import * as yargs from "yargs"
import * as zlib from "zlib"
import { generateCertificate } from "../../../../utils/generate-certificate"
import { log } from "../../../../utils/log"
import { getConfig } from "../../../../utils/project-config"

const app = new Koa()

const projectRootPath = yargs.argv.projectRootPath
const dashboardBundleRootPath = yargs.argv.dashboardBundleRootPath
const serverPort = yargs.argv.serverPort
const clientPort = yargs.argv.clientPort
const dashboardBundleFileName = yargs.argv.dashboardBundleFileName

const staticPrefix = "/static"

const projectConfig = getConfig(projectRootPath, "local")

app.use(koaCors())

app.use(
  koaCompress({
    flush: zlib.Z_SYNC_FLUSH
  })
)

app.use(
  koaMount(
    staticPrefix,
    koaStatic(dashboardBundleRootPath, {
      gzip: true
    })
  )
)

app.use(async ctx => {
  ctx.set("Content-Type", "text/html; charset=utf-8")

  ctx.body = `
    <html>

    <head>
      <style>
        html,
        body {
          margin: 0;
          padding: 0;
        }
      </style>

      <link href="${staticPrefix}/${dashboardBundleFileName}.css" media="all" rel="stylesheet" />
    </head>

    <body>
      <div id="root"></div>
      <script>
        window.serverPort = ${serverPort}
      </script>
      <script src="${staticPrefix}/${dashboardBundleFileName}.js"></script>
    </body>

    </html>
  `
})

if (projectConfig.useHttps) {
  https
    .createServer(
      generateCertificate(
        path.join(projectRootPath, ".temp/dashboard-client-server")
      ),
      app.callback()
    )
    .listen(clientPort)
} else {
  http.createServer(app.callback()).listen(clientPort)
}

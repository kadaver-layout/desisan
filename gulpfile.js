import gulp from "gulp";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import browserSync from "browser-sync";
import nunjucksRender from "gulp-nunjucks-render";
import sass from "gulp-sass";
import * as dartSass from "sass";
import sourcemaps from "gulp-sourcemaps";
import gulpif from "gulp-if";
import autoprefixer from "gulp-autoprefixer";
import postcss from "gulp-postcss";
import sortMediaQueries from "postcss-sort-media-queries";
import webpackStream from "webpack-stream";
import webpack from "webpack";
import plumber from "gulp-plumber";
import terser from "gulp-terser";
import newer from "gulp-newer";
import sharp from "sharp";
import { deleteAsync } from "del";
import { readFileSync } from "fs";
import data from "gulp-data";
import concat from "gulp-concat";
import merge from "merge-stream";
import fs from "fs";
import through2 from "through2";

const sassCompiler = sass(dartSass);
const server = browserSync.create();
const argv = yargs(hideBin(process.argv)).argv;

const isProd = () => !!argv.prod;
const isDev = () => !argv.prod;

const path = {
  src: {
    html: "src/*.html",
    // Папка с html-партиалами/лейаутами, которые использует nunjucks.
    // Кладём её ПОЛНОСТЬЮ и как есть в dist, чтобы её можно было редактировать
    // прямо в dist, без git и без открытия исходников.
    htmlRaw: "src/html/**/*",
    data: "src/data/**/*.{json,js}",
    scss: ["src/assets/styles/main.sass", "src/assets/styles/libs/*.*"],
    js: "src/assets/js/**/*.{js,ts}",
    image: "src/assets/img/**/*.{jpg,jpeg,png,gif,svg,ico}",
    video: "src/assets/video/**/*.{mp4,MP4}",
    fonts: "src/assets/fonts/**/*.{woff,woff2,ttf}",
  },
  dist: {
    base: "dist/",
    html: "dist/",
    // Сюда кладём полную копию src/html как есть (без обработки nunjucks)
    htmlRaw: "dist/html/",
    css: "dist/assets/css/",
    js: "dist/assets/js/",
    // Сюда кладём полную, несжатую, несобранную копию папки js.
    // Этот файл(ы) НЕ подключается к сайту и НЕ участвует в сборке app.js —
    // он только для того, чтобы можно было посмотреть/поправить исходники прямо в dist.
    jsRaw: "dist/assets/js/raw/",
    image: "dist/assets/img/",
    video: "dist/assets/video/",
    fonts: "dist/assets/fonts/",
  },
  watch: {
    html: "src/**/*.html",
    htmlRaw: "src/html/**/*",
    data: "src/data/**/*.{json,js}",
    scss: "src/assets/styles/**/*.{sass,scss}",
    js: "src/assets/js/**/*.{js,ts}",
    image: "src/assets/img/**/*.{jpg,jpeg,png,gif,svg}",
    video: "src/assets/video/**/*.mp4",
    fonts: "src/assets/fonts/**/*.{woff,woff2,ttf}",
  },
};

function serverStart() {
  server.init({
    server: { baseDir: path.dist.base, mimeTypes: { woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf", mp4: "video/mp4" } },
    notify: false,
    online: true,
    snippetOptions: { rule: { fn: (snippet, match) => `<script async src="/browser-sync/browser-sync-client.js?v=3.0.4"></script>${match}` } },
  });
}

async function clean() {
  return await deleteAsync(path.dist.base);
}

// Рендерим страницы через nunjucks — как и раньше, без изменений.
function html() {
  return gulp
    .src(path.src.html)
    .pipe(plumber())
    .pipe(data(() => fs.existsSync("src/data/data.json") ? JSON.parse(readFileSync("src/data/data.json", "utf8")) : {}))
    .pipe(nunjucksRender({ path: ["src/html"] }))
    .pipe(gulp.dest(path.dist.html))
    .pipe(server.reload({ stream: true }));
}

// НОВОЕ: полная копия папки src/html "как есть" в dist/html.
// Не обрабатывается nunjucks'ом, ничего не меняется — просто зеркало исходников.
function htmlRaw() {
  return gulp
    .src(path.src.htmlRaw)
    .pipe(plumber({ errorHandler: function (err) { console.log("HTML raw copy error:", err.message); this.emit("end"); } }))
    .pipe(newer(path.dist.htmlRaw))
    .pipe(gulp.dest(path.dist.htmlRaw))
    .pipe(server.reload({ stream: true }));
}

function scss() {
  const libsStream = gulp
    .src(path.src.scss[1])
    .pipe(plumber())
    .pipe(gulpif(isDev(), sourcemaps.init()))
    .pipe(sassCompiler().on("error", sassCompiler.logError))
    .pipe(gulpif(isProd(), autoprefixer({ grid: true })))
    .pipe(gulpif(isProd(), postcss([sortMediaQueries()])))
    .pipe(gulpif(isDev(), sourcemaps.write()))
    .pipe(gulp.dest(path.dist.css + "libs"));

  const mainStream = gulp
    .src(path.src.scss[0])
    .pipe(plumber())
    .pipe(gulpif(isDev(), sourcemaps.init()))
    .pipe(sassCompiler().on("error", sassCompiler.logError))
    .pipe(gulpif(isProd(), autoprefixer({ grid: true })))
    .pipe(gulpif(isProd(), postcss([sortMediaQueries()])))
    .pipe(concat("main.css"))
    .pipe(gulpif(isDev(), sourcemaps.write()))
    .pipe(gulp.dest(path.dist.css));

  return merge(libsStream, mainStream).pipe(server.stream());
}

// Собираем рабочий, подключаемый на сайте бандл — как и раньше.
// В проде он же минифицируется терсером (это и есть "сжатый файл, который работает в сборке").
function js() {
  return gulp
    .src(path.src.js)
    .pipe(plumber({
      errorHandler: function (err) {
        console.log("JS build error:", err.message);
        this.emit("end");
      },
    }))
    .pipe(
      webpackStream(
        {
          mode: isProd() ? "production" : "development",
          // source-map пишет карту в отдельный .map-файл,
          // а не заворачивает код в eval() — сам бандл остаётся читаемым.
          devtool: isDev() ? "source-map" : false,
          module: {
            rules: [{ test: /\.ts$/, use: "ts-loader" }],
          },
          resolve: { extensions: [".ts", ".js"] },
          output: { filename: "app.js" },
          optimization: {
            minimize: false,
          },
        },
        webpack
      )
    )
    .pipe(
      gulpif(
        isProd(),
        terser({
          mangle: false,
          compress: false,
          format: {
            beautify: true,
            comments: "all",
            indent_level: 2,
          },
        })
      )
    )
    .pipe(gulp.dest(path.dist.js))
    .pipe(server.reload({ stream: true }));
}

// НОВОЕ: полная копия исходных js-файлов "как есть", без бандлинга и без сжатия.
// Никак не подключается к сайту — лежит рядом для тех, кто работает только с dist.
function jsRaw() {
  return gulp
    .src(path.src.js)
    .pipe(plumber({ errorHandler: function (err) { console.log("JS raw copy error:", err.message); this.emit("end"); } }))
    .pipe(newer(path.dist.jsRaw))
    .pipe(gulp.dest(path.dist.jsRaw))
    .pipe(server.reload({ stream: true }));
}

function image() {
  // 1. Копируем все оригинальные изображения
  const copyOriginals = gulp
    .src(path.src.image, { encoding: false })
    .pipe(plumber({ errorHandler: function (err) { console.log("Image error:", err.message); this.emit("end"); } }))
    .pipe(newer(path.dist.image))
    .pipe(gulp.dest(path.dist.image));

  // 2. Конвертируем в WebP только jpg, jpeg, png, gif
  const convertToWebP = gulp
    .src(path.src.image, { encoding: false })
    .pipe(plumber({ errorHandler: function (err) { console.log("WebP error:", err.message); this.emit("end"); } }))
    .pipe(newer({ dest: path.dist.image, ext: '.webp' }))
    .pipe(
      through2.obj(function (file, enc, cb) {
        const ext = file.extname.toLowerCase();

        // Пропускаем svg и ico
        if (!['.jpg', '.jpeg', '.png', '.gif'].includes(ext)) {
          return cb(null, file);
        }

        const webpPath = file.path
          .replace(path.src.image.split('**')[0], path.dist.image)
          .replace(/\.(jpg|jpeg|png|gif)$/i, '.webp');

        sharp(file.contents)
          .webp({ quality: 80 })
          .toFile(webpPath)
          .then(() => {
            cb(null, file);
          })
          .catch((err) => {
            console.error(`Sharp error for ${file.path}:`, err.message);
            cb(null, file);
          });
      })
    );

  return merge(copyOriginals, convertToWebP)
    .pipe(server.reload({ stream: true }));
}

function video() {
  console.log("📹 Video task started, looking for:", path.src.video);
  return gulp
    .src(path.src.video, { encoding: false, allowEmpty: true })
    .pipe(plumber({ errorHandler: function (err) { console.log("Video error:", err.message); this.emit("end"); } }))
    .pipe(gulp.dest(path.dist.video))
    .pipe(server.reload({ stream: true }));
}

function fonts() {
  return gulp
    .src(path.src.fonts, { encoding: false })
    .pipe(plumber({ errorHandler: function (err) { console.log("Font error:", err.message); this.emit("end"); } }))
    .pipe(newer(path.dist.fonts))
    .pipe(gulp.dest(path.dist.fonts))
    .pipe(server.reload({ stream: true }));
}

function watch() {
  gulp.watch(path.watch.html, html);
  gulp.watch(path.watch.htmlRaw, htmlRaw);
  gulp.watch(path.watch.data, html);
  gulp.watch(path.watch.scss, scss);
  gulp.watch(path.watch.js, gulp.parallel(js, jsRaw));
  gulp.watch(path.watch.image, image);
  gulp.watch(path.watch.video, video);
  gulp.watch(path.watch.fonts, fonts);
}

const build = gulp.series(clean, gulp.parallel(html, htmlRaw, scss, js, jsRaw, image, video, fonts));
const dev = gulp.series(build, gulp.parallel(watch, serverStart));

export { build, dev };
export default dev;
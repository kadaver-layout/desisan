# DESISAN

Стартовая структура для вёрстки DESISAN. Экраны макета ещё не сверстаны.
Макет: https://www.figma.com/design/KPYwWJy0qNwCsycikeMwUH/DESISAN?node-id=0-1

Сборка перенесена из union-layout: `gulpfile.js`, `package.json`,
`package-lock.json` и `projectConfig.json` скопированы без изменений.
`projectConfig.json` сохранён для совместимости; Gulp использует пути внутри gulpfile.js.
Название npm-пакета gulp-template сохранено, как в исходном проекте.

## Запуск

- `npm ci` — установка версий из lock-файла.
- `npm run dev` — сборка, BrowserSync и наблюдение за файлами.
- `npm run prod` — production-режим, также с сервером и наблюдением, как в оригинале.
- `npx gulp build` — разовая development-сборка.
- `npx gulp build --prod` — разовая production-сборка.

Для зависимостей из lock-файла используйте Node.js 22.13+ (включая требование yargs).

## Структура

- `src/*.html` — страницы Nunjucks.
- `src/html/layouts` — базовый шаблон.
- `src/html/includes` — переиспользуемые блоки.
- `src/data/data.json` — данные, доступные в каждом шаблоне.
- `src/assets/styles/main.sass` — точка входа Sass, отдельные файлы блоков, БЭМ.
- `src/assets/styles/libs` — стили библиотек, собираются отдельно.
- `src/assets/js/app.js` — JavaScript; сборка через Webpack.
- `src/assets/img`, `fonts`, `video` — ресурсы.
- `dist` — результат сборки, очищается перед полной сборкой.

В dist также копируются исходные шаблоны (`html`) и исходный JS (`assets/js/raw`).
JPG, PNG, GIF конвертируются в WebP с качеством 80, оригиналы сохраняются.
Development включает source maps; production — Autoprefixer и сортировку media queries.
CSS не минифицируется. JS проходит через Terser без mangle и compress, с beautify.

## Библиотеки и ограничения оригинальной сборки

Сохранены все зависимости, включая Tom Select, Splide, Splide Grid, MicroModal и jQuery.
Наличие пакета не означает его автоматическое подключение: JS импортируется по мере необходимости.
Собственная галерея и код карт union-layout не переносились: это логика конкретного сайта.
CSS Tom Select и Splide подключён так же, как в исходном main.sass.

Папка assets/libs не копируется отдельной задачей: libsJs оставлен пустым.
Для библиотек используйте npm-импорты через Webpack.
В конфигурации есть правило TypeScript, но ts-loader и typescript не установлены,
как и в исходном проекте. Стартовый код использует JavaScript.
Данные читаются только из data.json, несмотря на наблюдение за *.js в src/data.
Шрифты, цвета и геометрия стартовой страницы временные, не являются реализацией макета.

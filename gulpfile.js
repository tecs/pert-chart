const gulp = require('gulp');
const gulpSass = require('gulp-sass')(require('sass'));
const fs = require('fs');

const sass = () => {
    if (fs.existsSync('public/css/style.css')) {
        fs.unlinkSync('public/css/style.css');
    }
    return gulp.src('src/scss/*.scss')
        .pipe(gulpSass({outputStyle: 'compressed'}).on('error', gulpSass.logError))
        .pipe(gulp.dest('public/css'));
};

const html = () => gulp.src('src/html/*').pipe(gulp.dest('public'));
const js = () => gulp.src('src/js/*').pipe(gulp.dest('public/js'));
const build = gulp.series(sass, html, js);
const watch = () => gulp.watch('src/*', gulp.series(build));

exports.watch = watch;
exports.default = build;


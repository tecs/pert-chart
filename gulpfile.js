const gulp = require('gulp');
const sass = require('gulp-sass');
const fs = require('fs');

gulp.task('default', ['sass', 'html', 'js']);

gulp.task('sass', () => {
    if (fs.existsSync('public/css/style.css')) {
        fs.unlinkSync('public/css/style.css');
    }
    return gulp.src('scss/*.scss')
        .pipe(sass({outputStyle: 'compact'})
        .on('error', sass.logError))
        .pipe(gulp.dest('public/css'));
});

gulp.task('html', () => gulp.src('html/*').pipe(gulp.dest('public')));
gulp.task('js', () => gulp.src('js/*').pipe(gulp.dest('public/js')));

gulp.task('watch', () => { gulp.watch('src/*', ['default']); });

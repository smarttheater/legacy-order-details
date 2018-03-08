var gulp = require('gulp');
var plumber = require('gulp-plumber');
var concat = require('gulp-concat');
var sass = require('gulp-sass');
var autoPrefixer = require('gulp-autoprefixer');
var cssComb = require('gulp-csscomb');
var csso = require('gulp-csso');
var mmq = require('gulp-merge-media-queries');

var dir_src = './public';
var dir_dst = './public';

gulp.task('sass',function(){
	gulp.src([
		dir_src+'/scss/___**.scss',
		dir_src+'/scss/__*.scss',
		dir_src+'/scss/_*.scss',
		dir_src+'/scss/**/*.scss',
		'!'+dir_src+'/scss/print/*.scss'
	])
	.pipe(plumber({
		handleError: function (err) {
			console.log(err);
			this.emit('end');
		}
	}))
	.pipe(concat('style.scss'))
	.pipe(sass())
	.pipe(autoPrefixer())
	.pipe(cssComb())
	.pipe(mmq())
	.pipe(csso())
	.pipe(gulp.dest(dir_dst+'/css'))
	gulp.src([
		dir_src+'/scss/__reset.scss',
		dir_src+'/scss/print/*.scss'
	])
	.pipe(plumber({
		handleError: function (err) {
			console.log(err);
			this.emit('end');
		}
	}))
	.pipe(concat('print.scss'))
	.pipe(sass())
	.pipe(autoPrefixer())
	.pipe(cssComb())
	.pipe(mmq())
	.pipe(csso())
	.pipe(gulp.dest(dir_dst+'/css'))
});

// チェックインアプリ用
const browserify = require('browserify');
const envify = require('envify/custom');
const uglifyEs = require('uglify-es');
const buffer = require('vinyl-buffer');
const gulpIf = require('gulp-if');
const uglifyComposer = require('gulp-uglify/composer');
const minifyEs = uglifyComposer(uglifyEs, console);
const saveLicense = require('uglify-save-license');
const source = require('vinyl-source-stream');
const argv = require('yargs').argv;
const isDev = !!argv.dev;
gulp.task('vueifyCheckinApp', () => {
    browserify({
        entries: [
            `${dir_src}/js/checkin/src/main.js`,
        ],
	})
	.transform(envify({ NODE_ENV: ((isDev) ? 'development' : 'production') }), {
        global: true,
	})
	.bundle()
	.pipe(plumber())
	.pipe(source(`${dir_dst}/js/checkin/app.js`))
	.pipe(buffer())
	.pipe(gulpIf(!isDev, minifyEs({
		output: {
			comments: saveLicense,
		},
	})))
	.pipe(gulp.dest('./'));
});


// gulp.task('default',['sass'],function(){
gulp.task('default',['sass', 'vueifyCheckinApp'],function(){
	gulp.watch(dir_src+'/scss/**/*.scss',['sass']);
    gulp.watch([`${dir_src}/js/checkin/src/**/*.js`, `${dir_src}/js/checkin/src/**/*.vue`], ['vueifyCheckinApp']);
});


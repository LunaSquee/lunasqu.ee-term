'use strict'

// gulp and utilities
import gulp from 'gulp'
import sourcemaps from 'gulp-sourcemaps'
import del from 'del'
import gutil from 'gulp-util'
import gdata from 'gulp-data'
import gulpif from 'gulp-if'
import plumber from 'gulp-plumber'
import mergeStream from 'merge-stream'
import Sequence from 'run-sequence'
import watch from 'gulp-watch'
import lazypipe from 'lazypipe'
import debug from 'gulp-debug'
import { assign } from 'lodash'
import webpack from 'webpack'
import webpackConfig from './webpack.config.js'
import filter from 'gulp-filter'

// script
import standard from 'gulp-standard'

// style
import stylus from 'gulp-stylus'
import nib from 'nib'
import csso from 'gulp-csso'

// document
import pug from 'gulp-pug'
import htmlmin from 'gulp-htmlmin'
import watchPug from 'gulp-watch-pug'

const sequence = Sequence.use(gulp)

let sources = {
  style: ['main.styl'],
  document: ['index.pug'],
  script: ['main.js']
}
let lintES = ['src/script/**/*.js', 'server/**/*.js', 'script/**/*.js', 'gulpfile.babel.js', 'app.js']

let inProduction = process.env.NODE_ENV === 'production' || process.argv.indexOf('-p') !== -1

let stylusOpts = {
  use: nib(),
  compress: false
}
let cssoOpts = {
  restructure: true
}

let watchOpts = {
  readDelay: 500,
  verbose: true
}

let pugOpts = {
  pretty: !inProduction
}

let htmlminOpts = {
  collapseWhitespace: true,
  removeComments: true,
  removeAttributeQuotes: true,
  collapseBooleanAttributes: true,
  removeRedundantAttributes: true,
  removeEmptyAttributes: true,
  removeScriptTypeAttributes: true,
  removeStyleLinkTypeAttributes: true
}

function styleTask () {
  return gulp.src(sources.style.map(function (f) { return 'src/style/' + f }))
    .pipe(plumber())
    .pipe(gulpif(!inProduction, sourcemaps.init()))
      .pipe(stylus(stylusOpts))
      .pipe(gulpif(inProduction, csso(cssoOpts)))
    .pipe(gulpif(!inProduction, sourcemaps.write()))
    .pipe(debug({title: '[style]'}))
    .pipe(gulp.dest('build/style/'))
}

if (inProduction) {
  webpackConfig.plugins.push(new webpack.optimize.DedupePlugin())
  webpackConfig.plugins.push(new webpack.optimize.OccurenceOrderPlugin(false))
  webpackConfig.plugins.push(new webpack.optimize.UglifyJsPlugin({
    compress: {
      warnings: false,
      screw_ie8: true
    },
    comments: false,
    mangle: {
      screw_ie8: true
    },
    screw_ie8: true,
    sourceMap: false
  }))
}

let wpCompiler = webpack(assign({}, webpackConfig, {
  cache: {},
  devtool: inProduction ? null : 'inline-source-map',
  debug: !inProduction
}))

function webpackTask (callback) {
  // run webpack
  wpCompiler.run(function (err, stats) {
    if (err) throw new gutil.PluginError('webpack', err)
    gutil.log('[script]', stats.toString({
      colors: true,
      hash: false,
      version: false,
      chunks: false,
      chunkModules: false
    }))
    if (typeof callback === 'function') callback()
  })
}

function documentTask (p) {
  let data = {
    config: require('./scripts/config'),
    env: process.env.NODE_ENV || 'development'
  }
  return p
    .pipe(plumber())
    .pipe(gdata(function () { return data }))
    .pipe(pug(pugOpts))
    .pipe(gulpif(inProduction, htmlmin(htmlminOpts)))
    .pipe(gulp.dest('build/document/'))
    .pipe(debug({title: '[document]'}))
}

let lintESPipe = lazypipe()
  .pipe(standard)
  .pipe(standard.reporter, 'default', { breakOnError: false })

// Cleanup tasks
gulp.task('clean', () => del('build'))
gulp.task('clean:quick', ['clean:script', 'clean:style', 'clean:document'], (done) => {
  done()
})
gulp.task('clean:script', () => {
  return del('build/script')
})
gulp.task('clean:style', () => {
  return del('build/style')
})
gulp.task('clean:icons', () => {
  return del('build/icons')
})
gulp.task('clean:document', () => {
  return del('build/document')
})

// Main tasks
gulp.task('script', ['clean:script'], webpackTask)
gulp.task('watch:script', () => {
  return watch(['src/script/**/*.js'], watchOpts, webpackTask)
})

gulp.task('style', ['clean:style'], (done) => {
  return sequence('build:style', done)
})
gulp.task('build:style', styleTask)
gulp.task('watch:style', () => {
  return watch('src/style/**/*.styl', watchOpts, styleTask)
})

gulp.task('document', ['clean:document'], () => {
  return documentTask(gulp.src(sources.document.map(function (f) { return 'src/document/' + f })))
})
gulp.task('watch:document', () => {
  return documentTask(
    watch(['src/document/**/*.pug'], watchOpts)
    .pipe(watchPug('src/document/**/*.pug', {delay: 100}))
    .pipe(filter(sources.document.map(function (f) { return 'src/document/' + f })))
  )
})

gulp.task('lint', () => {
  return mergeStream(
    gulp.src(lintES).pipe(lintESPipe())
  )
})
gulp.task('watch:lint', () => {
  return mergeStream(
    watch(lintES, watchOpts, function (file) {
      gulp.src(file.path).pipe(lintESPipe())
    })
  )
})

// Default task
gulp.task('default', (done) => {
  sequence('script', 'style', 'document', 'lint', done)
})

// Watch task
gulp.task('watch', (done) => {
  sequence('default', ['watch:lint', 'watch:script', 'watch:style', 'watch:document'], done)
})

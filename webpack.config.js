'use strict'
import path from 'path'

let inProduction = process.env.NODE_ENV === 'production' || process.argv.indexOf('-p') !== -1

export default {
  entry: {
    main: ['./src/script/main']
  },
  output: {
    path: __dirname,
    filename: './build/script/[name].js',
    chunkFilename: './build/script/[id].js'
  },
  module: {
    preLoaders: [
    ],
    loaders: [
      {
        test: /\.js$/,
        loader: 'babel',
        exclude: /node_modules/,
        query: {
          sourceMaps: inProduction,
          presets: ['es2015'],
          plugins: ['transform-strict-mode']
        }
      }
    ],
    noParse: [
    ]
  },

  resolve: {
    extensions: ['', '.js', '.json'],
    root: [path.join(__dirname, '/src/script')],

    alias: {
    }
  },

  plugins: [
  ],

  devtool: 'inline-source-map',
  debug: true
}

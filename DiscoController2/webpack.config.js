var webpack = require('webpack');

var config = {
  context: __dirname + '/src/scripts',
  entry: {
    "main": "./main.js",
    "vendor": "./vendor.js"
  },

  output: {
    path: __dirname + '/build/scripts/',
    filename: '[name].js'
  },

  devtool: 'source-map',

  module: {
    noParse: [ /.+zone\.js\/dist\/.+/, /.+angular2\/bundles\/.+/ ],
    loaders: [
      {
        test: /\.js$/,
        loader: 'babel',
        exclude: /(node_modules)/,
        query: {
          presets: ['es2015'],
          plugins: [
            'angular2-annotations',
            'transform-decorators-legacy'
          ]
        }
      }
    ]
  },

  // Remove all modules in vendor bundle from app bundle
  plugins: [
    new webpack.optimize.CommonsChunkPlugin("vendor", "vendor.js")
  ]
};

// Local public path for dist
if (process.env.ENVIRONMENT === 'DIST') {
  config.output.publicPath = '../build/';
}

module.exports = config;

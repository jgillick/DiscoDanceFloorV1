var webpack = require('webpack');

module.exports = {
  context: __dirname + '/scripts',
  entry: {
    "app": "./main.ts",
    "vendor": "./vendor.ts"
  },

  output: {
    path: __dirname + '/build',
    filename: '[name].js',
    publicPath: 'http://localhost:8080/build/'
  },

  devtool: 'source-map',

  module: {
    loaders: [
      { test: /\.scss$/, loader: 'style-loader!css-loader!sass-loader' },

      // Typescript
      { test: /\.ts/, loader: 'ts-loader', exclude: /node_modules/ },

      // Static files
      { test: /\.(jpe|jpg|woff|woff2|eot|ttf|svg|html)(\?.*$|$)/, loader: 'file' }
    ]
  },

  // Remove all modules in vendor bundle from app bundle
  plugins: [
    new webpack.optimize.CommonsChunkPlugin("vendor", "vendor.js")
  ]
};

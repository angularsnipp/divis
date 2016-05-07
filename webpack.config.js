var ExtractTextPlugin = require("extract-text-webpack-plugin");

module.exports = {
  entry: './src',
  output: {
    filename: 'build/divis.js',
    libraryTarget: 'umd',
    library: 'Divis'
  },
  externals: [{
    d3: 'd3'
  }],
  module: {
    loaders: [
      {
        test: /\.js$/,
        loader: ['babel'],
        query: {
          presets: ['es2015']
        },
        exclude: /node_modules/
      },
      {
        test: /\.css|.scss$/,
        loader: ExtractTextPlugin.extract(
          'style-loader',
          'css-loader?sourceMap&modules&localIdentName=[local]!postcss-loader'
        ),
      }
    ]
  },
  postcss: function() {
    return [
      require('precss')(),
      require('autoprefixer')(),
    ];
  },
  plugins: [
    new ExtractTextPlugin("build/divis.css", { allChunks: true })
  ]
};
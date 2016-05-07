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
      }
    ]
  }
};
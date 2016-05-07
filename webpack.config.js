module.exports = {
  entry: './src',
  output: {
    filename: 'build/divis.js',
    libraryTarget: 'umd',
    library: 'divis'
  },
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
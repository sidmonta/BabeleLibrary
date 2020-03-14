const path = require('path')

module.exports = {
  mode: 'production',
  target: 'node',
  entry: {
    lodservice: path.resolve(__dirname, './lib/index.ts')
  },
  output: {
    path: path.resolve(__dirname, '.'),
    filename: 'index.js',
    library: 'babelelibrary',
    libraryTarget: 'umd'
  },
  name: 'lodservice',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js']
  }
}

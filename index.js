const webpack = require('webpack')
const path = require('path')

webpack({
    entry: './kk.js',
    module: {
        rules: [
            {
                test: /\.js/,
                loader: path.resolve(__dirname, './kk.js')
            }
        ]
    }
}, () => {
    console.log('1111')
})
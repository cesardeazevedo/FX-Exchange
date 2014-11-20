var gulp        = require('gulp'),
    harp        = require('harp'),
    browserSync = require('browser-sync'),
    cp          = require('child_process');

var paths = {
        'sass'    : 'assets/themes/FX-Exchange/**/*.sass', // Sass files
        'html'    : ['**/*.ejs']
    };

gulp.task('harp-build', function(done){
    cp.exec('harp compile . _site', { stdio: 'inherit'}).on('close', done);
});

gulp.task('harp-sass', function(){
    browserSync.reload("blinktrade.css", { stream: true});
});

gulp.task('harp-html', function(){
	browserSync.reload('index.html', { stream: true });
});

gulp.task("browser-sync", function() {
    harp.server(__dirname, {
        port: 3000
    }, function() {
        browserSync({
            proxy: 'localhost:3000',
            open: true
        });
    });
});

//Watch your Sass, Less, Stylus files and will be compiled by HarpJS
gulp.task('watch', function(){
    gulp.watch([paths.sass], ['harp-sass'] );
    gulp.watch([paths.html], ['harp-html']);
});

gulp.task('default', [ 'browser-sync', 'watch' ]);

gulp.task('build', ['harp-build']);

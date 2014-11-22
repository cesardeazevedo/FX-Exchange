var gulp        = require('gulp'),
    harp        = require('harp'),
    browserSync = require('browser-sync'),
    cp          = require('child_process');

var paths = {
        'stylus'  : 'assets/themes/FX-Exchange/**/*.styl',
        'html'    : ['**/*.ejs'],
    };

gulp.task('harp-build', function(done){
    cp.exec('harp compile . _site', { stdio: 'inherit'}).on('close', done);
});

/*
 * reload when stylus files was changed
 */
gulp.task('harp-stylus', function(){
        browserSync.reload('blinktrade.css', { stream: true });
});

gulp.task('harp-html', function(){
        browserSync.reload('index.html', { stream : true });
});

gulp.task("browser-sync", function() {
    harp.server(__dirname, {
        port: 3000
    }, function() {
        browserSync({
            proxy: "localhost:3000",
            open: true
        });
    });
});

gulp.task('watch', function(){
    gulp.watch([ paths.stylus ], ['harp-stylus']);
    gulp.watch([ paths.html   ], ['harp-html']);
});

gulp.task('default', [ 'browser-sync', 'watch' ]);

gulp.task('build', ['harp-build']);

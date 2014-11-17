var gulp        = require('gulp'),
    harp        = require('harp'),
    browserSync = require('browser-sync'),
    cp          = require('child_process');

var paths = {
        'stylus' : 'assets/themes/FX-Exchange/**/*.styl',
        'css'    : 'assets/themes/FX-Exchange/css/**.css',
        'html'   : ['**/*.ejs']
    };

gulp.task('harp-build', function(done){
    cp.exec('harp compile . _site', { stdio: 'inherit'}).on('close', done);
    cp.exec('rm -r _site/.git');
});

gulp.task('harp-rebuild', ['harp-build'], function(){
    browserSync.reload();
});

gulp.task("browser-sync", ['harp-rebuild' ], function() {
    harp.server(__dirname, {
        port: 3000
    }, function() {
        browserSync({
            server : {
                baseDir: '_site'
            }
        });
    });
});

gulp.task('watch', function(){
    gulp.watch([paths.stylus], ['harp-rebuild'] );
    gulp.watch([paths.html, paths.css], ['harp-rebuild']);
});

gulp.task('default', [ 'browser-sync', 'watch' ]);

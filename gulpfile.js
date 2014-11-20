var gulp        = require('gulp'),
    harp        = require('harp'),
    browserSync = require('browser-sync'),
    cp          = require('child_process');

var paths = {
        'sass'    : 'assets/themes/FX-Exchange/**/*.sass', // Sass files
        'css'     : 'assets/themes/FX-Exchange/css/**.css',
        'cssDir'  : 'assets/themes/FX-Exchange/css',
        'cssDest' : '_site/assets/themes/FX-Exchange/css',
        'html'    : ['**/*.ejs']
    };

gulp.task('harp-build', function(done){
    cp.exec('harp compile . _site', { stdio: 'inherit'}).on('close', done);
    cp.exec('rm -r _site/.git');
});

gulp.task('harp-rebuild', ['harp-build'], function(){
    browserSync.reload();
});

gulp.task('harp-sass', function(){
	cp.exec('harp compile ' + paths.cssDir + ' ' + paths.cssDest, function(){
		browserSync.reload("blinktrade.css", { stream: true});
	});
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

//Watch your Sass, Less, Stylus files and will be compiled by HarpJS
gulp.task('watch', function(){
    gulp.watch([paths.sass], ['harp-sass'] );
    gulp.watch([paths.html, paths.css], ['harp-rebuild']);
});

gulp.task('default', [ 'browser-sync', 'watch' ]);

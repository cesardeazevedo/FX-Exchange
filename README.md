FX-Exchange
====

My Frontend Theme  to [blinktrade frontend](https://github.com/blinktrade/frontend)

##Demo
[See Demo](http://cesardeazevedo.github.io/FX-Exchange)

##Tools
* [Gulp](https://github.com/gulpjs/gulp) for build system.
* [Harp](https://github.com/sintaxi/harp) to compile stylus and EJS files
* [BrowserSync](BrowserSync) to sync brownser with livereload

#Build and Run
install the dependencies with

    $ npm install

build and run it with gulp task, the browser will show up automatically at `http://localhost:3001`

    $ gulp
    
##Compile
you can compile harpjs to the `_site` folder.

    $ harp compile . _site
    
##Generator
this project was initial released with [generator-blinktrade](https://github.com/cesardeazevedo/generator-blinktrade) scaffolding, with jekyll for static generator html pages, but was hard changed to support gulp, harp and browserSync architecture.

##Start new theme
you can start a new theme based on this architecture.

    $ git clone https://github.com/cesardeazevedo/FX-Exchange.git
    $ git checkout StartNewTheme

##Screenshot
![Screenshot](http://i.imgur.com/zkFRhNO.png?1)

## License
[GNU GENERAL PUBLIC LICENSE](https://github.com/cesardeazevedo/FX-Exchange/blob/master/LICENSE) © Blinktrade, Inc.

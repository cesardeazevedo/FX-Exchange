FX-Exchange
====

My Frontend Theme  to [blinktrade frontend](https://github.com/blinktrade/frontend)


##Tools
* [Gulp](https://github.com/gulpjs/gulp) for build system.
* [Harp](https://github.com/sintaxi/harp) to compile stylus and EJS files
* [BrowserSync](BrowserSync) to sync brownser with livereload

##Build and Run
###Run
* Install the dependencies with

        $ npm install

* Run it with gulp task, the browser will show up automatically at `http://localhost:3001`

        $ gulp

###Build
* harpjs will compile to the `_site` folder.

        $ gulp build

##Generator
This project was initial released with [generator-blinktrade](https://github.com/cesardeazevedo/generator-blinktrade) scaffolding, with jekyll for static generator html pages, but was hard changed to support gulp, harp and browserSync architecture.

##Start new theme
You can start a new theme based on this architecture.

    $ git clone https://github.com/cesardeazevedo/FX-Exchange.git
    $ git checkout StartNewTheme

##Screenshots


## License
[GNU GENERAL PUBLIC LICENSE](https://github.com/cesardeazevedo/FX-Exchange/blob/master/LICENSE) © Blinktrade, Inc.

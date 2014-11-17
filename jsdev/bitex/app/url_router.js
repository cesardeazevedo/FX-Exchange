goog.provide('bitex.app.UrlRouter');
goog.provide('bitex.app.UrlRouter.EventType');
goog.provide('bitex.app.UrlRouterEvent');

goog.require('goog.events');
goog.require('goog.history.Html5History');
goog.require('goog.string');


/**
 * @param {*} app
 * @param {string} baseUrl
 * @param {string} defaultView
 * @constructor
 * @extends {goog.events.EventTarget}
 */
bitex.app.UrlRouter = function(app, baseUrl, defaultView) {
  this.urls_ = [];

  this.app_ = app;
  this.history_ = null
  this.base_url_ = baseUrl;
  this.default_view_ = defaultView;
};
goog.inherits(bitex.app.UrlRouter, goog.events.EventTarget);


/**
 * @type {string}
 * @private
 */
bitex.app.UrlRouter.prototype.base_url_;

/**
 * @type {string}
 * @private
 */
bitex.app.UrlRouter.prototype.default_view_;

/**
 * @type {string}
 * @private
 */
bitex.app.UrlRouter.prototype.current_view_;


/**
 * @type {goog.history.Html5History}
 * @private
 */
bitex.app.UrlRouter.prototype.history_;

/**
 * @type {Array.<Object>}
 * @private
 */
bitex.app.UrlRouter.prototype.urls_;

/**
 * @type {Array.<*>}
 * @private
 */
bitex.app.UrlRouter.prototype.activeViewInfo_;

/**
 * The events fired by the web socket.
 * @enum {string} The event types for the web socket.
 */
bitex.app.UrlRouter.EventType = {
  SET_VIEW: 'set_view'
};


bitex.app.UrlRouter.prototype.addView = function(view_name, viewObject) {
  this.urls_.push( { re: view_name, view:viewObject } );
};


/**
 * @param {string} view_name
 * @protected
 */
bitex.app.UrlRouter.prototype.setViewInternal = function(view_name){
  var actual_view_name = goog.string.remove(view_name, this.base_url_ );

  if  ( actual_view_name === "" ) {
    actual_view_name = this.default_view_;
  }

  var urlMapping =  goog.array.find(this.urls_, function( url_object  ) {
    var re = new RegExp(url_object.re,"g");
    if (goog.isDefAndNotNull(re.exec( actual_view_name ))) {
      return true;
    }
  });


  if (!goog.isDefAndNotNull(urlMapping)) {
    return false;
  }

  if (this.current_view_ === actual_view_name ) {
    return false;
  }


  if (goog.isDefAndNotNull(this.activeViewInfo_) ) {
    this.activeViewInfo_.view.exitView();
  }

  var view_data = new RegExp(urlMapping.re,"g").exec(actual_view_name);
  var view_url = view_data[0];
  var view_id = view_data[1];
  var args = view_data.splice(2);

  this.current_view_ = actual_view_name;
  this.activeViewInfo_ = urlMapping;
  this.activeViewInfo_.view.enterView(args);

  return true;
};

/**
 * @param {string} view_name
 */
bitex.app.UrlRouter.prototype.setView = function(view_name) {
  var urlMapping =  goog.array.find(this.urls_, function( url_object  ) {
    var re = new RegExp(url_object.re,"g");
    if (goog.isDefAndNotNull(re.exec( view_name ))) {
      return true;
    }
  });

  if ( view_name[0] === '/' && !goog.isDefAndNotNull(urlMapping)) {
    this.setView( view_name.substr(1) );
    return;
  }

  var actual_view_name = goog.string.remove(view_name, this.base_url_ );
  var view_data = new RegExp(urlMapping.re,"g").exec(actual_view_name);
  var view_url = view_data[0];
  var view_id = view_data[1];
  var view_args = view_data.splice(2);


  var res = this.dispatchEvent(
      new bitex.app.UrlRouterEvent( bitex.app.UrlRouter.EventType.SET_VIEW, view_id, urlMapping.view, view_args,view_url ));

  if (!res) {
    return;
  }


  if (!this.setViewInternal(view_name)) {
    return;
  }

  if (goog.isDefAndNotNull(this.history_)) {
    this.history_.setToken( this.base_url_ + view_name);
  }
};


bitex.app.UrlRouter.prototype.init = function(){
  this.history_ = new goog.history.Html5History();
  this.history_.setUseFragment(true);

  this.history_.addEventListener( goog.history.EventType.NAVIGATE, this.onNavigate_, undefined, this);
  this.history_.setEnabled(true);
};

/**
 * @return {string}
 */
bitex.app.UrlRouter.prototype.getCurrentView = function() {
  return this.current_view_;
};

/**
 * @param {goog.events.Event} e
 * @private
 */
bitex.app.UrlRouter.prototype.onNavigate_ = function(e){
  if (e.isNavigation) {
    var view_name = e.token;

    var urlMapping =  goog.array.find(this.urls_, function( url_object  ) {
      var re = new RegExp(url_object.re,"g");
      if (goog.isDefAndNotNull(re.exec( view_name ))) {
        return true;
      }
    });

    var actual_view_name = goog.string.remove(view_name, this.base_url_ );
    var view_data = new RegExp(urlMapping.re,"g").exec(actual_view_name);
    var view_url = view_data[0];
    var view_id = view_data[1];
    var view_args = view_data.splice(2);

    var res = this.dispatchEvent(
        new bitex.app.UrlRouterEvent( bitex.app.UrlRouter.EventType.SET_VIEW, view_id, urlMapping.view, view_args,view_url ));

    if (res) {
      this.setViewInternal(view_name);
    }
  }
};

/**
 *
 * @param {bitex.app.UrlRouter.EventType} type
 * @param {string} view_id
 * @param {bitex.view.View} view
 * @param {Array.<string>}  view_args
 * @param {string}  view_url
 * @constructor
 */
bitex.app.UrlRouterEvent = function(type,  view_id, view, view_args,view_url) {
  goog.events.Event.call(this, type);

  /**
   * @type {string}
   */
  this.view_id = view_id;

  /**
   * @type {bitex.view.View}
   */
  this.view = view;

  /**
   * @type {Array.<string>}
   */
  this.view_args = view_args;

  /**
   * @type {string}
   */
  this.view_url = view_url

};
goog.inherits(bitex.app.UrlRouterEvent, goog.events.Event);


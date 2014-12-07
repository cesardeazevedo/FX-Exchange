goog.provide('bitex.app.BlinkTrade');
goog.provide('bitex.app.blink_trade');

goog.require('goog.structs.Map');
goog.require('goog.structs.Set');

goog.require('bitex.util');
goog.require('bitex.api.BitEx');

goog.require('goog.soy');
goog.require('bitex.templates');

goog.require('bitex.ui.OrderBook');
goog.require('bitex.ui.OrderBook.Side');

goog.require('bitex.ui.SimpleOrderEntry.EventType');
goog.require('bitex.ui.AdvancedOrderEntry.EventType');

goog.require('bitex.ui.OrderBook.EventType');
goog.require('bitex.ui.OrderBookEvent');

goog.require('bitex.ui.OrderManager');
goog.require('bitex.ui.AccountActivity');
goog.require('bitex.ui.WithdrawList');

goog.require('bitex.ui.Customers');
goog.require('goog.Uri');

goog.require('goog.fx');
goog.require('goog.fx.dom');

goog.require('goog.events.InputHandler');

goog.require('goog.events');
goog.require('goog.dom.forms');
goog.require('goog.dom.classes');
goog.require('goog.dom.TagName');

goog.require('goog.ui.Button');

goog.require('goog.array');
goog.require('goog.string');
goog.require('goog.object');
goog.require('goog.json');

goog.require('bitex.app.UrlRouter');
goog.require('bitex.model.Model');
goog.require('bitex.model.Model.EventType');

goog.require('bootstrap.Dialog');
goog.require('bootstrap.Dialog.ButtonSet');
goog.require('bootstrap.Alert');
goog.require('bootstrap.Dropdown');
goog.require('bootstrap.Accordion');

goog.require('bitex.primitives.Price');

goog.require('goog.debug');

goog.require('bitex.view.NullView');
goog.require('bitex.view.SignupView');
goog.require('bitex.view.LoginView');
goog.require('bitex.view.ForgotPasswordView');
goog.require('bitex.view.SetNewPasswordView');
goog.require('bitex.view.VerificationView');
goog.require('bitex.view.DepositView');
goog.require('bitex.view.OfferBookView');
goog.require('bitex.view.SideBarView');
goog.require('bitex.view.WithdrawView');
goog.require('bitex.view.CustomersView');
goog.require('bitex.view.AccountOverview');
goog.require('bitex.view.BrokerView');
goog.require('bitex.view.TradingView');
goog.require('bitex.view.AlgorithmTradingView');
goog.require('bitex.view.ToolBarView');
goog.require('bitex.view.MarketView');
goog.require('bitex.view.LedgerView');
goog.require('bitex.view.ProfileView');
goog.require('bitex.view.RankingView');

goog.require('uniform.Uniform');
goog.require('uniform.Meta');               // Switch according to the test($MODULE_NAME$)
goog.require('uniform.Validators');         // Switch according to the test($MODULE_NAME$)


/**
 * @desc Password changed message
 */
var MSG_SUCCESS_PASSWORD_CHANGE = goog.getMsg('Password changed!');

/**
* @desc Password Chanced with success dialog title
*/
var MSG_BITEX_PASSWORD_CHANGED_OK_TITLE = goog.getMsg('Success');



/**
 * @param {number=} broker_id
 * @param {string=} opt_default_country
 * @param {string=} opt_default_state
 * @param {number=} opt_test_request_timer_in_ms. Defaults to 30 seconds
 * @param {number=} opt_maximum_allowed_delay_in_ms. Defaults to 10 seconds
 * @constructor
 * @extends {goog.events.EventTarget}
 */
bitex.app.BlinkTrade = function(broker_id, opt_default_country, opt_default_state, opt_test_request_timer_in_ms, opt_maximum_allowed_delay_in_ms) {
  goog.events.EventTarget.call(this);

  bootstrap.Dropdown.install();
  bootstrap.Accordion.install();

  this.dialog_ = null;
  this.error_message_alert_timeout_ = 5000;

  try {
    this.router_  = new bitex.app.UrlRouter( this, '', 'start');
    this.model_   = new bitex.model.Model(document.body);
    this.conn_    = new bitex.api.BitEx();
    this.views_   = new goog.ui.Component();
    this.pricemin_ = 0;
    this.pricemax_ = 0;
  } catch ( error) {
    this.showDialog(error);
  }

  if (goog.isDefAndNotNull(opt_default_country)) {
    this.model_.set('DefaultCountry', opt_default_country);
  }

  this.model_.set('DefaultBrokerID', broker_id);
  this.model_.set('SelectedBrokerID', broker_id);

  if (goog.isDefAndNotNull(opt_default_state)) {
    this.model_.set('DefaultState', opt_default_state);
  }

  this.open_orders_request_id_ = parseInt( 1e7 * Math.random() , 10 );

  this.maximum_allowed_delay_in_ms_ = opt_maximum_allowed_delay_in_ms || 10000;
  this.test_request_delay_          = opt_test_request_timer_in_ms || 30000;
  this.currency_info_               = {};
  this.all_markets_                 = {};
  this.locked_balance_              = {};
  this.test_request_timer_          = new goog.Timer(this.test_request_delay_);
  this.test_request_timer_.start();
};
goog.inherits(bitex.app.BlinkTrade, goog.events.EventTarget);
goog.addSingletonGetter(bitex.app.BlinkTrade);


/**
 * @type {bitex.app.UrlRouter}
 * @private
 */
bitex.app.BlinkTrade.prototype.router_;

/**
 * @type {bitex.model.Model}
 * @private
 */
bitex.app.BlinkTrade.prototype.model_;

/**
 * @type {string}
 * @private
 */
bitex.app.BlinkTrade.prototype.wss_url_;

/**
 * @type {string}
 * @private
 */
bitex.app.BlinkTrade.prototype.rest_url_;

/**
 * @type {bitex.api.BitEx}
 * @private
 */
bitex.app.BlinkTrade.prototype.conn_;

/**
 * @type {goog.Timer}
 * @private
 */
bitex.app.BlinkTrade.prototype.test_request_timer_;

/**
 * @type {goog.Timer}
 * @private
 */
bitex.app.BlinkTrade.prototype.test_request_deadline_timer_;

/**
 * @type {number}
 * @private
 */
bitex.app.BlinkTrade.prototype.maximum_allowed_delay_in_ms_;

/**
 * @type {goog.Timer}
 * @private
 */
bitex.app.BlinkTrade.prototype.test_request_delay_;


/**
 * @type {Object}
 * @private
 */
bitex.app.BlinkTrade.prototype.currency_info_;

/**
 * @type {Array}
 * @private
 */
bitex.app.BlinkTrade.prototype.all_markets_;


/**
 * Event handler.
 * TODO(user): rename it to handler_ after all component subclasses in
 * inside Google have been cleaned up.
 * Code search: http://go/component_code_search
 * @type {goog.events.EventHandler}
 * @private
 */
bitex.app.BlinkTrade.prototype.handler_;

/**
 * @type {goog.ui.Dialog}
 */
bitex.app.BlinkTrade.prototype.dialog_;

/**
 * @type {bitex.view.LoginView}
 */
bitex.app.BlinkTrade.prototype.loginView_;

/**
 * @type {bitex.view.LoginView}
 */
bitex.app.BlinkTrade.prototype.profileView_;

/**
 * @type {goog.ui.Component}
 */
bitex.app.BlinkTrade.prototype.views_;

/**
 * @type {number}
 */
bitex.app.BlinkTrade.prototype.open_orders_request_id_;

/**
 * @type {number}
 */
bitex.app.BlinkTrade.prototype.error_message_alert_timeout_;

/**
 * @type {Object}
 */
bitex.app.BlinkTrade.prototype.locked_balance_;

/**
 * @return {goog.events.EventHandler}
 */
bitex.app.BlinkTrade.prototype.getHandler = function() {
  return this.handler_ ||
      (this.handler_ = new goog.events.EventHandler(this));

};

/**
 * @return {string}
 */
bitex.app.BlinkTrade.prototype.getRestURL = function() {
  return this.rest_url_;
};


bitex.app.BlinkTrade.validateBitcoinAddress_ = function(el, condition, minLength, caption) {

  if (condition && !eval(condition)) {
    return;
  }
  /** @desc Error Validade Required in Validators*/
  var MSG_BITEX_ERROR_VALIDATE_REQUIRED = goog.getMsg("{$c} is required", {c:caption});

  /** @desc Error Validade Bitcoin Address*/
  var MSG_BITEX_ERROR_VALIDATE_BTC_ADDRESS = goog.getMsg("{$c} is not a valid address", {c:caption});


  var elValue = goog.dom.forms.getValue(el);
  if (!goog.isDefAndNotNull(elValue) || goog.string.isEmpty(elValue)) {
    throw MSG_BITEX_ERROR_VALIDATE_REQUIRED;
  }

  if ( !bitex.util.isValidAddress( elValue ) ) {
    throw MSG_BITEX_ERROR_VALIDATE_BTC_ADDRESS;
  }

}

/**
 * @param {string} host_api
 */
bitex.app.BlinkTrade.prototype.run = function(host_api) {
  this.instance_ = this;

  this.rest_url_ = 'https://' + host_api;
  this.wss_url_ = 'wss://' + host_api + '/trade/';

  uniform.Validators.getInstance().registerValidatorFn('validateAddress',  bitex.app.BlinkTrade.validateBitcoinAddress_);


  // Populate all the views
  var startView           = new bitex.view.NullView(this);
  var faqView             = new bitex.view.NullView(this);
  var setNewPasswordView  = new bitex.view.SetNewPasswordView(this);
  var loginView           = new bitex.view.LoginView(this);
  var signUpView          = new bitex.view.SignupView(this);
  var forgotPasswordView  = new bitex.view.ForgotPasswordView(this);
  var depositView         = new bitex.view.DepositView(this, false);
  var depositRequestsView = new bitex.view.DepositView(this, true);
  var verificationView    = new bitex.view.VerificationView(this);
  var offerBookView       = new bitex.view.OfferBookView(this);
  var withdrawView        = new bitex.view.WithdrawView(this, false);
  var withdrawRequestsView= new bitex.view.WithdrawView(this, true);
  var customersView       = new bitex.view.CustomersView(this);
  var accountOverviewView = new bitex.view.AccountOverview(this);
  var brokerView          = new bitex.view.BrokerView(this);
  var marketView          = new bitex.view.MarketView(this);
  var rankingView         = new bitex.view.RankingView(this);
  var tradingView         = new bitex.view.TradingView(this);
  var algorithmTradingView= new bitex.view.AlgorithmTradingView(this);
  var toolBarView         = new bitex.view.ToolBarView(this);
  var sideBarView         = new bitex.view.SideBarView(this);
  var ledgerView          = new bitex.view.LedgerView(this);
  var profileView         = new bitex.view.ProfileView(this);
  var brokerApplicationView= new bitex.view.NullView(this);

  this.views_.addChild( toolBarView         );
  this.views_.addChild( sideBarView         );
  this.views_.addChild( startView           );
  this.views_.addChild( faqView             );
  this.views_.addChild( setNewPasswordView  );
  this.views_.addChild( loginView           );
  this.views_.addChild( signUpView          );
  this.views_.addChild( forgotPasswordView  );
  this.views_.addChild( tradingView         );
  this.views_.addChild( algorithmTradingView);
  this.views_.addChild( offerBookView       );
  this.views_.addChild( depositView         );
  this.views_.addChild( depositRequestsView );
  this.views_.addChild( withdrawView        );
  this.views_.addChild( withdrawRequestsView);
  this.views_.addChild( customersView       );
  this.views_.addChild( accountOverviewView );
  this.views_.addChild( verificationView    );
  this.views_.addChild( brokerView          );
  this.views_.addChild( marketView          );
  this.views_.addChild( rankingView         );
  this.views_.addChild( ledgerView          );
  this.views_.addChild( profileView          , false);
  this.views_.addChild( brokerApplicationView);

  startView.decorate(goog.dom.getElement('start'));
  faqView.decorate(goog.dom.getElement('faq'));
  sideBarView.decorate(goog.dom.getElement('id_sidebar'));
  toolBarView.decorate(goog.dom.getElement('id_toolbar'));
  loginView.decorate(goog.dom.getElement('signin'));
  signUpView.decorate(goog.dom.getElement('signup'));
  this.views_.decorate(document.body);


  this.router_.addView( '(account_overview)/(\\w+)/$'   , accountOverviewView );
  this.router_.addView( '(start)'                       , startView           );
  this.router_.addView( '(faq)'                         , faqView             );
  this.router_.addView( '(admin)'                       , startView           );
  this.router_.addView( '(set_new_password)'            , setNewPasswordView  );
  this.router_.addView( '(signin)'                      , loginView           );
  this.router_.addView( '(signup)'                      , signUpView          );
  this.router_.addView( '(forgot_password)'             , forgotPasswordView  );
  this.router_.addView( '(algotrading)'                 , algorithmTradingView);
  this.router_.addView( '(trading)'                     , tradingView         );
  this.router_.addView( '(offerbook)'                   , offerBookView       );
  this.router_.addView( '(deposit_requests)'            , depositRequestsView );
  this.router_.addView( '(deposit)'                     , depositView         );
  this.router_.addView( '(withdraw_requests)'           , withdrawRequestsView);
  this.router_.addView( '(withdraw)'                    , withdrawView        );
  this.router_.addView( '(customers)'                   , customersView       );
  this.router_.addView( '(verification)'                , verificationView    );
  this.router_.addView( '(my_broker)'                   , brokerView          );
  this.router_.addView( '(market)'                      , marketView          );
  this.router_.addView( '(ranking)'                     , rankingView         );
  this.router_.addView( '(ledger)'                      , ledgerView          );
  this.router_.addView( '(profile)'                     , profileView         );
  this.router_.addView( '(broker_application)'          , brokerApplicationView);

  var handler = this.getHandler();

  handler.listen( this.router_ , bitex.app.UrlRouter.EventType.SET_VIEW, this.onBeforeSetView_ );

  handler.listen( this.conn_, bitex.api.BitEx.EventType.OPENED, this.onConnectionOpen_ );
  handler.listen( this.conn_, bitex.api.BitEx.EventType.CLOSED, this.onConnectionClose_);
  handler.listen( this.conn_, bitex.api.BitEx.EventType.ERROR ,  this.onConnectionError_);
  handler.listen( this.conn_, bitex.api.BitEx.EventType.ERROR_MESSAGE, this.onConnectionErrorMessage_);


  handler.listen( this.conn_ , bitex.api.BitEx.EventType.BROKER_LIST_RESPONSE, this.onBrokerListResponse_);
  handler.listen( this.conn_ , bitex.api.BitEx.EventType.SECURITY_LIST, this.onSecurityList_);
  handler.listen( this.conn_ , bitex.api.BitEx.EventType.LOGIN_OK, this.onUserLoginOk_);
  handler.listen( this.conn_ , bitex.api.BitEx.EventType.LOGIN_ERROR, this.onUserLoginError_);

  handler.listen( this.test_request_timer_, goog.Timer.TICK, this.onTestRequestTimer_ );
  handler.listen( this.conn_ , bitex.api.BitEx.EventType.HEARTBEAT, this.onHearbeat_);

  handler.listen(this.views_, bitex.view.View.EventType.CHANGE_PASSWORD, this.onUserChangePassword_ );
  handler.listen( this.conn_ , bitex.api.BitEx.EventType.CHANGE_PASSWORD_RESPONSE, this.onChangePasswordResponse_);

  handler.listen( this.conn_ , bitex.api.BitEx.EventType.TWO_FACTOR_SECRET, this.onBitexTwoFactorSecretResponse_);
  handler.listen( this.conn_ , bitex.api.BitEx.EventType.BALANCE_RESPONSE, this.onBitexBalanceResponse_);
  handler.listen( this.conn_ , bitex.api.BitEx.EventType.POSITION_RESPONSE, this.onBitexPositionResponse_);

  handler.listen( this.conn_ , bitex.api.BitEx.EventType.PASSWORD_CHANGED_OK, this.onBitexPasswordChangedOk_);
  handler.listen( this.conn_ , bitex.api.BitEx.EventType.PASSWORD_CHANGED_ERROR, this.onBitexPasswordChangedError_);
  handler.listen( this.conn_ , bitex.api.BitEx.EventType.DEPOSIT_METHODS_RESPONSE, this.onBitexDepositMethodsResponse_ );

  handler.listen( this.conn_ , bitex.api.BitEx.EventType.WITHDRAW_REFRESH, this.onBitexWithdrawIncrementalUpdate_);

  handler.listen( this.conn_, bitex.api.BitEx.EventType.ORDER_LIST_RESPONSE + '.' + this.open_orders_request_id_, this.onBitexOrderListResponse_);
  handler.listen( this.conn_ , bitex.api.BitEx.EventType.EXECUTION_REPORT, this.onBitexExecutionReport_);

  handler.listen( this.conn_, bitex.api.BitEx.EventType.RAW_MESSAGE, goog.bind(  this.onBitexRawMessageLogger_, this, 'rx' ) );
  handler.listen( this.conn_, bitex.api.BitEx.EventType.SENT_RAW_MESSAGE, goog.bind(  this.onBitexRawMessageLogger_, this, 'tx' )  );

  handler.listen( this.conn_, bitex.api.BitEx.EventType.VERIFY_CUSTOMER_UPDATE, this.onBitexVerifyCustomerUpdate_ );

  handler.listen( this.conn_,bitex.api.BitEx.EventType.WITHDRAW_RESPONSE, this.onBitexWithdrawResponse_);
  handler.listen( this.conn_,bitex.api.BitEx.EventType.WITHDRAW_CONFIRMATION_RESPONSE, this.onBitexWithdrawConfirmationResponse_);

  handler.listen( this.conn_, bitex.api.BitEx.EventType.SUGGEST_TRUSTED_ADDRESS_PUBLISH, this.onSuggestTrustedAddress_);
  handler.listen( this.conn_, bitex.api.BitEx.EventType.UPDATE_PROFILE_RESPONSE, this.onUpdateProfileResponse_);



  handler.listen( document.body, goog.events.EventType.CLICK , this.onBodyClick_);
  handler.listen( document.body, goog.events.EventType.CHANGE , this.onBodyChange_);


  // Listen to the views
  handler.listen(signUpView, bitex.view.SignupView.EventType.SIGNUP, this.onUserSignupButton_ );
  handler.listen(loginView, bitex.view.LoginView.EventType.LOGIN, this.onUserLoginButtonClick_) ;

  handler.listen(profileView, bitex.view.View.EventType.ENABLE_TWOFACTOR, this.onUserEnableTwoFactor_);
  handler.listen(profileView, bitex.view.View.EventType.DISABLE_TWOFACTOR, this.onUserDisableTwoFactor_);

  handler.listen(forgotPasswordView, bitex.view.ForgotPasswordView.EventType.RECOVER_PASSWORD, this.onUserForgotPassword_);
  handler.listen(setNewPasswordView, bitex.view.SetNewPasswordView.EventType.SET_NEW_PASSWORD, this.onUserSetNewPassword_);
  handler.listen(sideBarView, bitex.view.SideBarView.EventType.CHANGE_MARKET, this.onUserChangeMarket_ );

  handler.listen(this.views_, bitex.view.View.EventType.CHANGE_BROKER, this.onUserChangeBroker_ );

  handler.listen(this.views_, bitex.ui.AdvancedOrderEntry.EventType.SUBMIT, this.onUserOrderEntry_ );
  handler.listen(this.views_, bitex.view.View.EventType.CANCEL_ORDER, this.onUserCancelOrder_ );
  handler.listen(this.views_, bitex.ui.SimpleOrderEntry.EventType.SUBMIT, this.onUserOrderEntry_ );

  handler.listen(this.views_, bitex.view.View.EventType.MARKET_DATA_SUBSCRIBE, this.onUserMarketDataSubscribe_);
  handler.listen(this.views_, bitex.view.View.EventType.MARKET_DATA_UNSUBSCRIBE, this.onUserMarketDataUnsubscribe_);

  handler.listen(this.views_, bitex.view.View.EventType.SECURITY_STATUS_SUBSCRIBE, this.onUserSecurityStatusSubscribe_);
  handler.listen(this.views_, bitex.view.View.EventType.SECURITY_STATUS_UNSUBSCRIBE, this.onUserSecurityStatusUnsubscribe_);

  handler.listen(this.views_, bitex.view.View.EventType.REQUEST_WITHDRAW, this.onUserWithdrawRequest_ );
  handler.listen(this.views_, bitex.view.View.EventType.CONFIRM_WITHDRAW, this.onUserConfirmWithdraw_ );
  handler.listen(this.views_, bitex.view.View.EventType.PROCESS_WITHDRAW, this.onBrokerProcessWithdraw_ );

  handler.listen(this.views_, bitex.view.View.EventType.DEPOSIT_REQUEST, this.onUserDepositRequest_ );
  handler.listen(this.views_, bitex.view.View.EventType.PROCESS_DEPOSIT, this.onProcessDeposit_ );


  handler.listen(this.views_, bitex.view.View.EventType.CONNECT_BITEX, this.onUserConnectBitEx_);

  handler.listen(this.views_, bitex.view.View.EventType.SHOW_QR, this.onUserShowQr_);

  handler.listen(this.views_, bitex.view.View.EventType.SHOW_RECEIPT, this.onShowReceipt_);
  handler.listen(this.views_, bitex.view.View.EventType.UPLOAD_RECEIPT, this.onUserUploadReceipt_);

  handler.listen(this.views_, bitex.view.View.EventType.SET_VERIFIED, this.onBrokerSetUserAsVerified_);
  handler.listen(this.views_, bitex.view.View.EventType.UPDATE_PROFILE, this.onUpdateProfile_ );

  handler.listen(this.views_, bitex.view.View.EventType.FILE_VIEW, this.onUserFileView_);


  var initial_view = 'start';
  if (!goog.string.isEmpty(location.hash)){
    initial_view = location.hash.substr(1);
  }

  this.router_.setView(initial_view);
  this.router_.init();

  this.loginView_ = loginView;
  this.profileView_ = profileView;


  this.getModel().set('JSVersion', '0.3' );

  this.connectBitEx();
};

/**
 * logger
 * @param {string} action
 * @param {bitex.api.BitExEvent} e
 * @private
 */
bitex.app.BlinkTrade.prototype.onBitexRawMessageLogger_ = function(action, e) {
  var raw_msg = e.data;
  try {
    var msg = JSON.parse(e.data);
    if ( goog.isDefAndNotNull(msg) ) {
      if (msg['MsgType'] != '0' && msg['MsgType'] != '1') {
        console.log(action + ':' + raw_msg);
      }
    }
  }catch(e){
    try {
      console.log(action + ':' + raw_msg);
    } catch(e) {}
  }
};


bitex.app.BlinkTrade.prototype.onBitexWithdrawConfirmationResponse_ = function(e) {
  var msg = e.data;

  if (!goog.isDefAndNotNull(msg['Status']) || msg['Status'] != '1' ) {

      /** @desc invalid confirmation toker */
      var MSG_INVALID_CONFIRMATION_TOKEN = goog.getMsg("Invalid confirmation token!");

      this.showNotification('error', MSG_INVALID_CONFIRMATION_TOKEN  );
      this.onBitexWithdrawResponse_(e);
  }
};


/**
 * @param {goog.events.Event} e
 * @private
 */
bitex.app.BlinkTrade.prototype.onBitexWithdrawResponse_ = function(e) {
  var msg = e.data;

  if ( this.getModel().get('Profile')['NeedWithdrawEmail'] ) {

      var dlg_content;
      if (this.getModel().get('TwoFactorEnabled')) {
        dlg_content = bitex.templates.GoogleAuthenticationCodeDialogContent();
      } else {
        dlg_content = bitex.templates.WithdrawConfirmationDialogContent();
      }

      /**
       * @desc withdraw confirmation dialog title
       */
      var MSG_WITHDRAW_CONFIRMATION_DIALOG_TITLE = goog.getMsg('Confirm');

      var withdrawConfirmationDialog = this.showDialog(dlg_content,
                                                       MSG_WITHDRAW_CONFIRMATION_DIALOG_TITLE,
                                                       bootstrap.Dialog.ButtonSet.createOkCancel());

      var form_element = goog.dom.getFirstElementChild(withdrawConfirmationDialog.getContentElement());
      var withdraw_confirmation_uniform = new uniform.Uniform();
      withdraw_confirmation_uniform.decorate(  form_element );

      var handler = this.getHandler();
      handler.listen(withdrawConfirmationDialog, goog.ui.Dialog.EventType.SELECT, function(e) {
        if (e.key == 'ok') {

          var error_list = withdraw_confirmation_uniform.validate();
          if (error_list.length > 0) {
            goog.array.forEach(error_list, function(error_msg) {
              this.showNotification( 'error', error_msg );
            }, this );

            e.stopPropagation();
            e.preventDefault();
          } else {
            var withdraw_confirmation_data = withdraw_confirmation_uniform.getAsJSON();

            if (this.getModel().get('TwoFactorEnabled')) {
              var token = withdraw_confirmation_data['token'];
              var withdraw_id = msg['WithdrawID'];
              this.conn_.confirmWithdraw( undefined, withdraw_id, token);
            } else {
              var confirmation_code = withdraw_confirmation_data['confirmation_code'];
              this.conn_.confirmWithdraw( confirmation_code );
            }
          }
        }
      }, this);
  }
};



/**
 * Connect to the bitex Server
 */
bitex.app.BlinkTrade.prototype.connectBitEx = function(){
  try {
    this.conn_.open(this.wss_url_);
  } catch( e ) {
    /**
     * @desc Connection error message when trying to open websockets connection for the first time
     */
    var MSG_CONNECTION_ERROR = goog.getMsg('Error connecting to the server. Your browser MUST SUPPORT WebSockets.');

    var error_dialog = bitex.templates.ErrorDialogContent({
                                                            error_message: MSG_CONNECTION_ERROR,
                                                            error_code: 'WebSocket: ' + e
                                                          });

    var dlg = this.showDialog(error_dialog, undefined, bootstrap.Dialog.ButtonSet.createYesNoCancel());
  }
};

bitex.app.BlinkTrade.prototype.getBitexConnection = function(){
  return this.conn_;
};

/**
 * @param {string} view_id
 */
bitex.app.BlinkTrade.prototype.setView = function(view_id){

  this.router_.setView(view_id);
};


bitex.app.BlinkTrade.prototype.onUserMarketDataSubscribe_ = function(e) {
  this.conn_.subscribeMarketData(e.target.getMDMarketDepth(),
                                 e.target.getMDInstruments(),
                                 e.target.getMDEntries(),
                                 e.target.getMDSubscriptionId());
};

bitex.app.BlinkTrade.prototype.onUserMarketDataUnsubscribe_ = function(e) {
  this.conn_.unSubscribeMarketData(e.target.getMDSubscriptionId());
};

bitex.app.BlinkTrade.prototype.onUserSecurityStatusSubscribe_ = function(e) {
  this.conn_.subscribeSecurityStatus(e.target.getSecurities(),
                                 e.target.getSecSubscriptionId());
};

bitex.app.BlinkTrade.prototype.onUserSecurityStatusUnsubscribe_ = function(e) {
  this.conn_.unSubscribeSecurityStatus(e.target.getSecSubscriptionId());
};

/**
 * @param {string} symbol
 * @return {string}
 */
bitex.app.BlinkTrade.prototype.getPriceCurrencyFromSymbol = function(symbol) {
  return symbol.substr(3);
};
/**
 * @param {string} symbol
 * @return {string}
 */
bitex.app.BlinkTrade.prototype.getQtyCurrencyFromSymbol = function(symbol) {
  return symbol.substr(0,3);
};

/**
 * @param {goog.events.Event} e
 */
bitex.app.BlinkTrade.prototype.onUserChangeBroker_ = function(e) {
  var brokerID = e.target.getBrokerID();
  this.getModel().set('SelectedBrokerID', brokerID);
};

/**
 * @param {goog.events.Event} e
 */
bitex.app.BlinkTrade.prototype.onUserChangePassword_ = function(e) {

  var password = e.target.getCurrentPassword();
  var new_password = e.target.getNewPassword();


  this.getBitexConnection().changePassword(this.getModel().get('SelectedBrokerID'),
                                           this.getModel().get('Username'),
                                           password,
                                           new_password);
};

/**
 * @param {bitex.api.BitExEvent} e
 */
bitex.app.BlinkTrade.prototype.onChangePasswordResponse_ = function(e) {
  var msg = e.data;

  if (msg['NeedSecondFactor']) {
    /**
     * @desc google authentication dialog title
     */
    var MSG_CHANGE_PASSWORD_TWO_STEPS_AUTHENTICATION_DIALOG_TITLE = goog.getMsg('2 steps authentication');



    var dlg_content = bitex.templates.GoogleAuthenticationCodeDialogContent();

    var dlg_ = this.showDialog(dlg_content,
                               MSG_CHANGE_PASSWORD_TWO_STEPS_AUTHENTICATION_DIALOG_TITLE,
                               bootstrap.Dialog.ButtonSet.createOkCancel() );
    var gauth_uniform = new uniform.Uniform();
    gauth_uniform.decorate(goog.dom.getFirstElementChild(dlg_.getContentElement()));

    var handler = this.getHandler();
    handler.listen(dlg_, goog.ui.Dialog.EventType.SELECT, function(e) {
      if (e.key == 'ok') {
        var error_list = gauth_uniform.validate();
        if (error_list.length > 0) {
          goog.array.forEach(error_list, function(error_msg) {
            this.showNotification( 'error', error_msg );
          }, this );

          e.stopPropagation();
          e.preventDefault();
        } else {
          var second_factor = gauth_uniform.getAsJSON()['token'];

          var password = this.profileView_.getCurrentPassword();
          var new_password = this.profileView_.getNewPassword();

          this.getBitexConnection().changePassword(this.getModel().get('SelectedBrokerID'),
                                                   this.getModel().get('Username'),
                                                   password,
                                                   new_password,
                                                   second_factor );
          dlg_.dispose();
        }
      }
    });
  } else {
    if (msg['UserStatusText'] == 'MSG_SUCCESS_PASSWORD_CHANGE') {
      this.showDialog( MSG_SUCCESS_PASSWORD_CHANGE,  MSG_BITEX_PASSWORD_CHANGED_OK_TITLE );
    } else {
      this.showDialog( msg['UserStatusText'] );
    }
  }
};


/**
 * @param {goog.events.Event} e
 */
bitex.app.BlinkTrade.prototype.onUserChangeMarket_ = function(e) {

  var symbol = e.target.getSymbol();
  var qtyCurrency = this.getQtyCurrencyFromSymbol(symbol);
  var priceCurrency = this.getPriceCurrencyFromSymbol(symbol);

  /**
   * @type {bitex.model.OrderBookCurrencyModel}
   */
  var qtyCurrencyDef = this.currency_info_[qtyCurrency];

  /**
   * @type {bitex.model.OrderBookCurrencyModel}
   */
  var priceCurrencyDef = this.currency_info_[priceCurrency];

  this.getModel().set('SelectedSymbol', {
    symbol: symbol ,
    qty_currency: qtyCurrencyDef,
    price_currency: priceCurrencyDef
  });

};



/**
 * @param {bitex.api.BitExEvent} e
 * @private
 */
bitex.app.BlinkTrade.prototype.onBitexDepositMethodsResponse_ = function(e) {
  var msg = e.data;


  var deposit_methods = [];
  goog.array.forEach( msg['DepositMethodGrp'], function(deposit_method) {
    var deposit_method_id = deposit_method['DepositMethodID'];
    var description = deposit_method['Description'];
    var disclaimer = deposit_method['Disclaimer'];
    var type = deposit_method['Type'];
    var currency = deposit_method['Currency'];
    var percent_fee = deposit_method['PercentFee'];
    var fixed_fee = deposit_method['FixedFee'];
    var deposit_limits = deposit_method['DepositLimits'];

    deposit_methods.push( { id:deposit_method_id,
                           description:description,
                           disclaimer:disclaimer,
                           type: type,
                           currency:currency,
                           percent_fee: percent_fee,
                           fixed_fee: fixed_fee,
                           deposit_limits: deposit_limits
                         } );
  });

  this.getModel().set('DepositMethods', deposit_methods);
};

/**
 * @param {bitex.api.BitExEvent} e
 * @private
 */
bitex.app.BlinkTrade.prototype.onBitexPasswordChangedOk_ = function(e) {
  var msg = e.data;

  if (msg['UserStatusText'] == 'MSG_SUCCESS_PASSWORD_CHANGE') {
    this.showDialog( MSG_SUCCESS_PASSWORD_CHANGE, MSG_BITEX_PASSWORD_CHANGED_OK_TITLE );
  } else {
    this.showDialog( msg['UserStatusText'], MSG_BITEX_PASSWORD_CHANGED_OK_TITLE );
  }

  this.router_.setView('signin');
};

/**
 * @param {bitex.api.BitExEvent} e
 * @private
 */
bitex.app.BlinkTrade.prototype.onBitexPasswordChangedError_ = function(e) {
  /**
   * @desc Password Chanced with success dialog title
   */
  var MSG_BITEX_PASSWORD_CHANGED_ERROR_TITLE = goog.getMsg('Error');

  /**
   * @desc Password Chanced with success dialog content
   */
  var MSG_BITEX_PASSWORD_CHANGED_ERROR_CONTENT = goog.getMsg('There was an error changing the password');

  var msg = e.data;
  if (msg['UserStatusText'] == 'MSG_CHANGE_PASSWORD_INVALID_SECURITY_CODE') {
    /**
     * @desc Password changed message
     */
    var MSG_CHANGE_PASSWORD_INVALID_SECURITY_CODE = goog.getMsg('Invalid security code.');

    this.showDialog( MSG_CHANGE_PASSWORD_INVALID_SECURITY_CODE , MSG_BITEX_PASSWORD_CHANGED_ERROR_TITLE );
  } else {

    this.showDialog( MSG_BITEX_PASSWORD_CHANGED_ERROR_CONTENT, MSG_BITEX_PASSWORD_CHANGED_ERROR_TITLE );
  }

};

/**
 * @param {bitex.api.BitExEvent} e
 * @private
 */
bitex.app.BlinkTrade.prototype.onBitexWithdrawIncrementalUpdate_ = function(e) {
  var msg = e.data;

  /**
   * @desc Withdraw user notification
   */
  var MSG_WITHDRAW_NOTIFICATION_USER_UNCONFIRMED_TITLE = goog.getMsg('Created withdraw [{$id}] ', {id: msg['WithdrawID']});

  /**
   * @desc Withdraw user notification
   */
  var MSG_WITHDRAW_NOTIFICATION_USER_CONFIRMED_TITLE = goog.getMsg('Withdraw [{$id}] confirmed', {id: msg['WithdrawID']});

  /**
   * @desc Withdraw user notification
   */
  var MSG_WITHDRAW_NOTIFICATION_USER_PROGRESS_TITLE = goog.getMsg('Withdraw [{$id}] in progress', {id: msg['WithdrawID']});

  /**
   * @desc Withdraw user notification
   */
  var MSG_WITHDRAW_NOTIFICATION_USER_COMPLETE_TITLE = goog.getMsg('Withdraw [{$id}] completed', {id: msg['WithdrawID']});

  /**
   * @desc Withdraw user notification
   */
  var MSG_WITHDRAW_NOTIFICATION_USER_CANCEL_TITLE = goog.getMsg('withdraw [{$id}] cancelled', {id: msg['WithdrawID']});


  var formatted_value = this.formatCurrency(msg['Amount']/1e8, msg['Currency'] );

  var notification_type_title;
  switch (msg['Status']) {
    case '0':
      notification_type_title = ['warning', MSG_WITHDRAW_NOTIFICATION_USER_UNCONFIRMED_TITLE];
      break;
    case '1': // CONFIRMED
      notification_type_title = ['info', MSG_WITHDRAW_NOTIFICATION_USER_CONFIRMED_TITLE];
      break;
    case '2': // IN PROGRESS
      notification_type_title = ['info', MSG_WITHDRAW_NOTIFICATION_USER_PROGRESS_TITLE];
      break;
    case '4': // COMPLETED
      notification_type_title = ['success', MSG_WITHDRAW_NOTIFICATION_USER_COMPLETE_TITLE];
      break;
    case '8': // CANCELLED
      notification_type_title = ['danger', MSG_WITHDRAW_NOTIFICATION_USER_CANCEL_TITLE];
      break;

  }
  if (goog.isDefAndNotNull(notification_type_title)) {
    this.showNotification(notification_type_title[0], notification_type_title[1], formatted_value);
  }
};

/**
 * @param {bitex.api.BitExEvent} e
 * @private
 */
bitex.app.BlinkTrade.prototype.onBitexVerifyCustomerUpdate_ = function(e) {
  var msg = e.data;

  var profile = this.getModel().get('Profile');
  var old_verified = profile['Verified'];

  profile['Verified']         = msg['Verified'];
  profile['VerificationData'] = msg['VerificationData'];
  this.getModel().set('Profile', profile);

  this.getModel().set('IsVerified',       profile['Verified'] > 1);

  /** @desc verification notification title msg */
  var MSG_NOTIFICATION_VERIFY_TITLE = goog.getMsg('Verification:');

  /** @desc pending verification notification content msg */
  var MSG_PENDING_VERIFICATION_CONTENT = goog.getMsg('Sent to the broker.');

  /** @desc pending verification notification content msg */
  var MSG_PROGRESS_VERIFICATION_CONTENT = goog.getMsg('In progress.');

  /** @desc level 2 verification notification content msg */
  var MSG_ACCOUNT_VERIFIED_CONTENT = goog.getMsg('You account has been verified. level - {$level}', {level : profile['Verified'] - 2 });


  if (old_verified == 0 && profile['Verified'] == 1  ) {
    this.router_.setView('offerbook');
    this.showNotification('success', MSG_NOTIFICATION_VERIFY_TITLE, MSG_PENDING_VERIFICATION_CONTENT);
  } else if (profile['Verified'] == 2  ) {
    this.showNotification('success', MSG_NOTIFICATION_VERIFY_TITLE, MSG_PROGRESS_VERIFICATION_CONTENT);
  } else if (profile['Verified'] >= 3  ) {
    this.showNotification('success', MSG_NOTIFICATION_VERIFY_TITLE, MSG_ACCOUNT_VERIFIED_CONTENT);
  }
};


/**
 * @param {bitex.api.BitExEvent} e
 * @private
 */
bitex.app.BlinkTrade.prototype.onBitexOrderListResponse_ = function(e) {
  var msg = e.data;

  //msg['OrdListGrp'], msg['Columns']
  goog.array.forEach(msg['OrdListGrp'], function(record_array){
    var execution_report_msg = {};
    goog.array.forEach(record_array, function(col_data, col_index){
      execution_report_msg[ msg['Columns'][col_index] ] = col_data;
    }, this);

    this.processExecutionReport_(execution_report_msg);
  }, this);

  if (msg['OrdListGrp'].length == msg['PageSize'] ) {
    this.conn_.requestOrderList(this.open_orders_request_id_ , msg['Page'] + 1, msg['PageSize'], ['0', '1'] );
  } else {
    this.getModel().set('FinishedInitialOpenOrdersRequest',  true);
  }
};

/**
 *
 * @param {Object} execution_report
 * @param {Object=} opt_current_order
 */
bitex.app.BlinkTrade.prototype.adjustLockedBalance_ = function(execution_report, opt_current_order){
  var currency;
  var is_buy_order = (execution_report['Side'] == '1');
  var is_sell_order = (execution_report['Side'] == '2');

  var new_volume = 0;
  var current_volume = 0;

  if (is_buy_order) {
    currency = this.conn_.getPriceCurrencyFromSymbol(execution_report['Symbol']);
    new_volume = execution_report['LeavesQty'] * execution_report['Price'] / 1e8;
    if (goog.isDefAndNotNull(opt_current_order)) {
      current_volume =  opt_current_order['LeavesQty'] * opt_current_order['Price'] / 1e8;
    }
  } else if (is_sell_order) {
    currency = this.conn_.getQtyCurrencyFromSymbol(execution_report['Symbol']);
    new_volume = execution_report['LeavesQty'];
    if (goog.isDefAndNotNull(opt_current_order)) {
      current_volume =  opt_current_order['LeavesQty'];
    }
  }

  var locked_balance = this.getModel().get('LockedBalance');
  if (!goog.isDefAndNotNull(locked_balance)) {
    locked_balance = {};
    locked_balance[this.getModel().get('SelectedBrokerID')] = {};
  }

  var current_locked_balance = locked_balance[this.getModel().get('SelectedBrokerID')][currency];
  if (!goog.isDefAndNotNull(current_locked_balance)) {
    current_locked_balance = 0;
  }
  current_locked_balance +=  (new_volume-current_volume);
  locked_balance[ this.getModel().get('SelectedBrokerID')][currency] = current_locked_balance;
  this.getModel().set('LockedBalance',locked_balance);



  var locked_balance_key = 'locked_balance_' +
      this.getModel().get('SelectedBrokerID') + ':' + this.getModel().get('UserID') + '_'  + currency;

  if (this.getModel().get( locked_balance_key ) != current_locked_balance) {

    // Update all running algorithms.
    var running_algorithms = this.getModel().get('RunningAlgorithms');
    goog.object.forEach(running_algorithms, function( running_algorithm) {
      var worker = running_algorithm['worker'];
      var balance_message= {};
      balance_message[currency + '_locked' ] =  current_locked_balance;
      worker.postMessage( { 'req': 'balance', 'balances': balance_message } );
    }, this);

    this.getModel().set( locked_balance_key , current_locked_balance);
    var value_fmt = new goog.i18n.NumberFormat(goog.i18n.NumberFormat.Format.DECIMAL);
    value_fmt.setMaximumFractionDigits(8);
    value_fmt.setMinimumFractionDigits(2);
    this.getModel().set('formatted_' + locked_balance_key, this.formatCurrency(current_locked_balance/1e8, currency, true));
    this.getModel().set('formatted_' + locked_balance_key + '_value', value_fmt.format(current_locked_balance/1e8));

    console.log(locked_balance_key + ':' + current_locked_balance );
  }
};

/**
 * @param {Object} execution_report
 */
bitex.app.BlinkTrade.prototype.processExecutionReport_ = function(execution_report) {
  var open_orders = this.getModel().get('OpenOrdersIndex');
  if (!goog.isDefAndNotNull(open_orders)) {
    open_orders = [];
  }

  var should_update_open_order_index_model = false;
  if (execution_report['OrdStatus'] == '2' || execution_report['OrdStatus'] == '4' ) {
    if (goog.array.binaryRemove( open_orders, execution_report['ClOrdID'] )) {
      this.adjustLockedBalance_(execution_report, this.getModel().get('order_' + execution_report['ClOrdID']));
      this.getModel().remove('order_' + execution_report['ClOrdID']);
      should_update_open_order_index_model = true;
    }
  } else {
    var idx_open_order = goog.array.binarySearch( open_orders, execution_report['ClOrdID']  );
    if (idx_open_order < 0 ) {
      goog.array.binaryInsert(open_orders, execution_report['ClOrdID'] ) ;
      this.adjustLockedBalance_(execution_report);
      should_update_open_order_index_model = true;
    } else {
      this.adjustLockedBalance_(execution_report, this.getModel().get('order_' + execution_report['ClOrdID']));
    }
    this.getModel().set('order_' + execution_report['ClOrdID'], execution_report);
  }

  if (should_update_open_order_index_model) {
    this.getModel().set('OpenOrdersIndex', open_orders);
  }

  if (this.getModel().get('FinishedInitialOpenOrdersRequest')) {
    // Update all running algorithms.
    var running_algorithms = this.getModel().get('RunningAlgorithms');
    goog.object.forEach(running_algorithms, function( running_algorithm) {
      var worker = running_algorithm['worker'];
      worker.postMessage( { 'req': 'execution_report', 'execution_report': execution_report } );
    }, this);
  }
};

/**
 * @param {bitex.api.BitExEvent} e
 * @private
 */
bitex.app.BlinkTrade.prototype.onBitexExecutionReport_ = function(e) {
  var msg = e.data;

  this.processExecutionReport_(msg);

  /**
   * @desc - execution report title notification message
   */
  var MSG_ORDER_EXECUTION_TITLE_NOTIFICATION = goog.getMsg("Order {$id} ", {id: msg['OrderID']} );

  /**
   * @desc - Partially filled notification message
   */
  var MSG_NOTIFICATION_ORDER_PARTIALLY_FILLED = goog.getMsg('partially filled');

  /**
   * @desc - filled notification message
   */
  var MSG_NOTIFICATION_ORDER_FILLED = goog.getMsg('filled');

  /**
   * @desc - Canceled notification message
   */
  var MSG_NOTIFICATION_ORDER_CANCELLED = goog.getMsg('cancelled');


  switch( msg['ExecType'] ) {
    case '1':  //Partial Execution
      this.showNotification('success', MSG_ORDER_EXECUTION_TITLE_NOTIFICATION, MSG_NOTIFICATION_ORDER_PARTIALLY_FILLED);
      break;
    case '2':  //Execution
      this.showNotification('success', MSG_ORDER_EXECUTION_TITLE_NOTIFICATION, MSG_NOTIFICATION_ORDER_FILLED);
      break;
    case '4':  //Offer Cancelled
      this.showNotification('success', MSG_ORDER_EXECUTION_TITLE_NOTIFICATION, MSG_NOTIFICATION_ORDER_CANCELLED);
      break;
  }
};


/**
 * @param {bitex.api.BitExEvent} e
 * @private
 */
bitex.app.BlinkTrade.prototype.onBitexTwoFactorSecretResponse_ = function(e){
  var msg = e.data;
  this.getModel().set('TwoFactorSecret', msg['TwoFactorSecret']);
  this.getModel().set('TwoFactorEnabled', msg['TwoFactorEnabled'] );
};


/**
 * @param {bitex.api.BitExEvent} e
 * @private
 */
bitex.app.BlinkTrade.prototype.onBitexPositionResponse_ = function(e) {
  var msg = e.data;
  delete msg['MsgType'];
  delete msg['PositionReqID'];

  var clientID = msg['ClientID'];

  goog.object.forEach(msg, function( positions, broker ) {
    goog.object.forEach(positions, function( position, currency ) {
      position = position / 1e8;
      // formatted_position_9000001:2_BTC
      var position_key = 'position_' + broker + ':' + clientID + '_'  + currency;
      this.getModel().set( position_key , position );

      if (position){
        this.getModel().set('formatted_' + position_key, this.formatCurrency(position, currency, true));
      } else {
        this.getModel().set('formatted_' + position_key, '');
      }
    }, this);
  },this);

};

/**
 * @param {bitex.api.BitExEvent} e
 * @private
 */
bitex.app.BlinkTrade.prototype.onBitexBalanceResponse_ = function(e) {
  var msg = e.data;
  delete msg['MsgType'];
  delete msg['BalanceReqID'];

  var clientID = msg['ClientID'];

  // Update all running algorithms.
  var running_algorithms = this.getModel().get('RunningAlgorithms');
  goog.object.forEach(running_algorithms, function( running_algorithm) {
    var worker = running_algorithm['worker'];
    var broker_id = this.getModel().get('SelectedBrokerID');
    if ( goog.object.containsKey(msg, broker_id ) ) {
      worker.postMessage( { 'req': 'balance', 'balances': msg[broker_id] } );
    }
  }, this);


  var value_fmt = new goog.i18n.NumberFormat(goog.i18n.NumberFormat.Format.DECIMAL);
  value_fmt.setMaximumFractionDigits(8);
  value_fmt.setMinimumFractionDigits(2);

  goog.object.forEach(msg, function( balances, broker ) {
    goog.object.forEach(balances, function( balance, currency ) {
      var balance_key = 'balance_' + broker + ':' + clientID + '_'  + currency;
      this.getModel().set( balance_key , balance );
      this.getModel().set('formatted_' + balance_key, this.formatCurrency(balance/1e8, currency, true));
      this.getModel().set('formatted_' + balance_key + '_value', value_fmt.format(balance/1e8));
    }, this);
  },this);
};

/**
 * @param {string} currency
 * @param {number=} opt_clientID
 * @private
 */
bitex.app.BlinkTrade.prototype.getDepositedAmount = function(currency, opt_clientID) {
  var broker_id = this.getModel().get('SelectedBrokerID');
  var clientID = this.getModel().get('UserID');
  if (goog.isDefAndNotNull(opt_clientID)){
    clientID = opt_clientID;
  }

  var balance_key = 'balance_' + broker_id + ':' + clientID + '_'  + currency;

  if (goog.isDefAndNotNull(this.getModel().get( balance_key ))) {
    return this.getModel().get( balance_key );
  }
  return 0;
};

/**
 * @param {string} currency
 * @param {number=} opt_clientID
 * @private
 */
bitex.app.BlinkTrade.prototype.getLockedAmount = function(currency, opt_clientID) {
  var broker_id = this.getModel().get('SelectedBrokerID');
  var clientID = this.getModel().get('UserID');
  if (goog.isDefAndNotNull(opt_clientID)){
    clientID = opt_clientID;
  }

  var balance_key = 'balance_' + broker_id + ':' + clientID + '_'  + currency;
  var locked_balance_key = 'locked_' + balance_key;

  if (goog.isDefAndNotNull(this.getModel().get( locked_balance_key ))) {
    return this.getModel().get( locked_balance_key );
  }

  return 0;
};


/**
 * @param {string} currency
 * @param {number=} opt_clientID
 * @private
 */
bitex.app.BlinkTrade.prototype.getAvailableBalanceForTrading = function(currency, opt_clientID) {
  var broker_id = this.getModel().get('SelectedBrokerID');
  var clientID = this.getModel().get('UserID');
  if (goog.isDefAndNotNull(opt_clientID)){
    clientID = opt_clientID;
  }

  var balance_key = 'balance_' + broker_id + ':' + clientID + '_'  + currency;
  var locked_balance_key = 'locked_' + balance_key;

  if (goog.isDefAndNotNull(this.getModel().get( balance_key ))) {
    if (goog.isDefAndNotNull(this.getModel().get( locked_balance_key ))) {
      return Math.round(this.getModel().get( balance_key ) - this.getModel().get( locked_balance_key ));
    } else {
      return this.getModel().get( balance_key )
    }
  } else {
    return 0;
  }
};

/**
 * @param {goog.events.Event} e
 * @private
 */
bitex.app.BlinkTrade.prototype.onUserWithdrawRequest_ = function(e){
  var currency = e.target.getCurrency();

  this.setView('withdraw');

  var withdraw_methods = goog.object.unsafeClone(this.getModel().get('Broker')['WithdrawStructure'][currency]);

  var user_verification_level = this.getModel().get('Profile')['Verified'];

  var balance_key = 'balance_' +
      this.getModel().get('Broker')['BrokerID'] + ':' + this.getModel().get('UserID') + '_' + currency;
  var user_balance = parseInt(this.getModel().get(balance_key,0), 10);

  var user_verified_withdraw_methods = [];
  goog.array.forEach(withdraw_methods, function(withdrawal_method){
    var withdrawal_limit;
    var withdrawal_limit_index;
    for (withdrawal_limit_index = user_verification_level; withdrawal_limit_index>=0;withdrawal_limit_index--) {
      withdrawal_limit = withdrawal_method['limits'][ withdrawal_limit_index ];
      if (goog.isDefAndNotNull(withdrawal_limit)) {
        break;
      }
    }

    var has_limits_enabled = false;
    if ( goog.isDefAndNotNull(withdrawal_limit) && goog.isDefAndNotNull(withdrawal_limit['enabled'])) {
      has_limits_enabled = withdrawal_limit['enabled'];
    }

    if ((!goog.isDefAndNotNull(withdrawal_limit['max'])) || (withdrawal_limit['max'] > user_balance) ) {
      var formatted_balance_key = 'formatted_balance_' +
          this.getModel().get('Broker')['BrokerID'] + ':' + this.getModel().get('UserID') + '_' + currency;
      var formatted_balance_value_key = formatted_balance_key + '_value';

      withdrawal_limit['max']                 = user_balance;
      withdrawal_limit['formatted_max']       = this.getModel().get(formatted_balance_key);
      withdrawal_limit['formatted_max_value'] = this.getModel().get(formatted_balance_value_key);
    }
    withdrawal_method['limits'][ withdrawal_limit_index ] = withdrawal_limit;

    if (has_limits_enabled) {
      user_verified_withdraw_methods.push(withdrawal_method);
    }
  }, this);


  var method_element_id = goog.string.getRandomString();
  var withdraw_amount_element_id = goog.string.getRandomString();
  var fixed_fee_element_id = goog.string.getRandomString();
  var percent_fee_element_id = goog.string.getRandomString();
  var total_fees_element_id = goog.string.getRandomString();
  var net_value_element_id = goog.string.getRandomString();
  var fmt = new goog.i18n.NumberFormat( goog.i18n.NumberFormat.Format.DECIMAL);



  var dialogContent = bitex.templates.DepositWithdrawDialogContent({
    fmt:fmt,
    side: 'client',
    currency: currency,
    verificationLevel: this.getModel().get('Profile')['Verified'],
    currencySign: this.getCurrencySign(currency),
    methods: user_verified_withdraw_methods,
    methodID: method_element_id,
    showFeeDataEntry:false,
    amountID: withdraw_amount_element_id,
    fixedFeeID: fixed_fee_element_id,
    percentFeeID: percent_fee_element_id,
    totalFeesID: total_fees_element_id,
    netValueID: net_value_element_id,
    hideNetAmount:false
  });

  /**
   * @desc Crypto Currency Withdraw accordion title
   */
  var MSG_CURRENCY_WITHDRAW_DIALOG_TITLE =
      goog.getMsg('{$currency} withdrawal', {currency :  this.getCurrencyDescription(currency) });

  var dlg =  this.showDialog(dialogContent,
                             MSG_CURRENCY_WITHDRAW_DIALOG_TITLE,
                             bootstrap.Dialog.ButtonSet.createOkCancel());
  var handler = this.getHandler();
  var withdrawal_form_el = goog.dom.getFirstElementChild(dlg.getContentElement());
  var withdrawal_uniform = new uniform.Uniform();
  withdrawal_uniform.decorate(withdrawal_form_el);

  goog.array.forEach( withdraw_methods, function(withdraw_method) {
    var method_id = withdraw_method['method'];
    handler.listen( new goog.events.InputHandler(goog.dom.getElement(method_id + '_' + withdraw_amount_element_id) ),goog.events.InputHandler.EventType.INPUT,function(e) {
      this.doCalculateFees_(
          method_id + '_' + withdraw_amount_element_id,
          method_id + '_' + fixed_fee_element_id,
          method_id + '_' + percent_fee_element_id,
          currency,
          method_id + '_' + total_fees_element_id,
          method_id + '_' + net_value_element_id,
          false,  // opt_add_fees
          true,   // opt_is_fixed_fee_in_satoshis
          false,  // opt_is_fixed_fee_formatted
          false,  // opt_is_amount_in_satoshis
          true,   // opt_is_amount_formatted
          false   // opt_is_percent_fee_formatted
          );
    }, this);
  }, this );


  var value_fmt = new goog.i18n.NumberFormat(goog.i18n.NumberFormat.Format.DECIMAL);
  value_fmt.setMaximumFractionDigits(8);
  value_fmt.setMinimumFractionDigits(2);

  handler.listen(dlg, goog.ui.Dialog.EventType.SELECT, function(e) {
    if (e.key == 'ok') {
      var error_list = withdrawal_uniform.validate();
      if (error_list.length > 0) {
        goog.array.forEach(error_list, function(error_msg) {
          this.showNotification( 'error', error_msg );
        }, this );

        e.stopPropagation();
        e.preventDefault();
      } else {
          var withdraw_data = withdrawal_uniform.getAsJSON();

          var amount = withdraw_data['Amount'];
          if (amount < 0) {
            /**
             * @desc Invalid withdrawal amount notification message during the withdrawal.
             */
            var MSG_INVALID_WITHDRAWAL_AMOUNT_VALUE = goog.getMsg('Invalid withdrawal amount');

            this.showNotification( 'error', MSG_INVALID_WITHDRAWAL_AMOUNT_VALUE );

            e.stopPropagation();
            e.preventDefault();
            return;
          }

          var pos = [0];
          var net_amount_el_value_id = withdraw_data['Method'] + '_' + net_value_element_id + '_value';
          var net_amount_value = parseInt(goog.dom.forms.getValue( goog.dom.getElement(net_amount_el_value_id)),10);

          withdraw_data['Fees'] =
              goog.dom.getTextContent(goog.dom.getElement(withdraw_data['Method'] + '_' + total_fees_element_id) );
          delete withdraw_data['Amount'];

          var method = withdraw_data['Method']; delete withdraw_data['Method'];
          var currency = withdraw_data['Currency']; delete withdraw_data['Currency'];

          this.conn_.requestWithdraw( e.target.getRequestId(),
                                      net_amount_value,
                                      method,
                                      currency,
                                      withdraw_data );
      }
    }
  }, this);
};


/**
 * @param {goog.events.Event} e
 * @private
 */
bitex.app.BlinkTrade.prototype.onUserConfirmWithdraw_ = function(e){
  this.conn_.confirmWithdraw(e.target.getConfirmationToken());
};


/**
 * @param {goog.events.Event} e
 * @private
 */
bitex.app.BlinkTrade.prototype.onUpdateProfile_ = function(e){
  var client_id = e.target.getClientID();
  var new_values = e.target.getProfileTagNewValues();
  this.conn_.updateUserProfile( new_values , client_id);
};



/**
 * @param {goog.events.Event} e
 * @private
 */
bitex.app.BlinkTrade.prototype.onUserFileView_ = function(e){
  /**
   * @desc File view dialog title
   */
  var MSG_FILE_VIEW_DIALOG_TITLE = goog.getMsg('View');


  var file_view_dialog_content = bitex.templates.FileViewDialogContent( {filename:e.target.getFilename()});
  this.showDialog( file_view_dialog_content,
                   MSG_FILE_VIEW_DIALOG_TITLE,
                   bootstrap.Dialog.ButtonSet.createOk() );
};


/**
 * @param {goog.events.Event} e
 * @private
 */
bitex.app.BlinkTrade.prototype.onBrokerSetUserAsVerified_ = function(e){
  var request_id = e.target.getRequestId();
  var client_id = e.target.getClientID();
  var verification_data = e.target.getVerificationData();
  var verification_level = e.target.getVerificationLevel();

  this.conn_.verifyCustomer(request_id, client_id, verification_level, verification_data );
};

/**
 * @param {goog.events.Event} e
 * @private
 */
bitex.app.BlinkTrade.prototype.onBrokerProcessWithdraw_ = function(e){
  var valueFormatter = new goog.i18n.NumberFormat(goog.i18n.NumberFormat.Format.DECIMAL);
  valueFormatter.setMinimumFractionDigits(2);
  valueFormatter.setMaximumFractionDigits(8);

  var withdraw_data = e.target.getWithdrawData();
  var request_id = e.target.getRequestId();
  var action = e.target.getWithdrawAction();
  var handler = this.getHandler();
  var model = this.getModel();

  var method_element_id = goog.string.getRandomString();
  var withdraw_amount_element_id = goog.string.getRandomString();
  var fixed_fee_element_id = goog.string.getRandomString();
  var percent_fee_element_id = goog.string.getRandomString();
  var total_fees_element_id = goog.string.getRandomString();
  var net_value_element_id = goog.string.getRandomString();


  if (action === 'CANCEL') {

    /**
     * @desc Cancel Withdraw dialog title
     */
    var MSG_WITHDRAW_CANCEL_DIALOG_TITLE = goog.getMsg('Cancel withdraw');

    var cancel_reason_dialog_content = bitex.templates.CancelWithdrawDialogContent( {
                                                                                      reason_id:'id_select_reason',
                                                                                      custom_reason_id:'id_custom_reason_text'
                                                                                    });
    var cancelWithdrawDlg =  this.showDialog( cancel_reason_dialog_content,
                                               MSG_WITHDRAW_CANCEL_DIALOG_TITLE,
                                               bootstrap.Dialog.ButtonSet.createOkCancel() );


    var select_reason_el = goog.dom.getElement('id_select_reason');
    var reason_el = goog.dom.getElement('id_custom_reason_text');
    handler.listen(select_reason_el, goog.events.EventType.CHANGE, function(e){
      var reason_id = goog.string.toNumber(goog.dom.forms.getValue( select_reason_el ));
      goog.style.showElement ( reason_el, (reason_id === 0 )) ;
    });

    handler.listen(cancelWithdrawDlg, goog.ui.Dialog.EventType.SELECT, function(e) {
      if (e.key == 'ok') {
        var reason_id = goog.string.toNumber(goog.dom.forms.getValue( select_reason_el ));
        var reason;

        if (reason_id === 0 ) {
          reason = goog.string.trim(goog.dom.forms.getValue(reason_el));

          if (goog.string.isEmpty(reason)) {
            e.stopPropagation();
            e.preventDefault();
            goog.dom.getElement('id_custom_reason_text').focus();
            return;
          }
        }

        this.getBitexConnection().processWithdraw(request_id,
                                                  action,
                                                  withdraw_data['WithdrawID'],
                                                  reason_id,
                                                  reason);
      }
    }, this);
  } else if (action === 'PROGRESS') {
    var formatted_amount = this.formatCurrency(withdraw_data['Amount']/1e8, withdraw_data['Currency'] );

    var feeDialogContent = bitex.templates.FeesForm({
       amount: withdraw_data['Amount'],
       formattedAmount: formatted_amount,
       currency: withdraw_data['Currency'],
       currencySign: this.getCurrencySign(withdraw_data['Currency']),
       amountID: withdraw_amount_element_id,
       fixedFeeID: fixed_fee_element_id,
       percentFeeID: percent_fee_element_id,
       totalFeesID: total_fees_element_id,
       netValueID: net_value_element_id,
       fixedFee: valueFormatter.format(withdraw_data['FixedFee']/1e8),
       percentFee: valueFormatter.format(withdraw_data['PercentFee'])
    });

    /**
     * @desc Crypto Currency Withdraw accordion title
     */
    var MSG_WITHDRAW_IN_PROGRESS_DIALOG_TITLE =
        goog.getMsg('Set {$currency} withdrawal in progress',
                    {currency :  this.getCurrencyDescription(withdraw_data['Currency']) });


    var feeDlg =  this.showDialog(feeDialogContent,
                                  MSG_WITHDRAW_IN_PROGRESS_DIALOG_TITLE,
                               bootstrap.Dialog.ButtonSet.createOkCancel());

    this.doCalculateFees_ (withdraw_amount_element_id,
                           fixed_fee_element_id,
                           percent_fee_element_id,
                           withdraw_data['Currency'],
                           total_fees_element_id,
                           net_value_element_id,
                           true,    // opt_add_fees
                           false,   // opt_is_fixed_fee_in_satoshis
                           true,    // opt_is_fixed_fee_formatted
                           true,    // opt_is_amount_in_satoshis
                           false,   // opt_is_amount_formatted
                           true     //  opt_is_percent_fee_formatted
    );

    handler.listen( new goog.events.InputHandler(goog.dom.getElement(withdraw_amount_element_id) ),
                    goog.events.InputHandler.EventType.INPUT,
                    goog.bind(this.doCalculateFees_, this,
                              withdraw_amount_element_id,
                              fixed_fee_element_id,
                              percent_fee_element_id,
                              withdraw_data['Currency'],
                              total_fees_element_id,
                              net_value_element_id,
                              true,    // opt_add_fees
                              false,   // opt_is_fixed_fee_in_satoshis
                              true,    // opt_is_fixed_fee_formatted
                              true,    // opt_is_amount_in_satoshis
                              false,   // opt_is_amount_formatted
                              true     //  opt_is_percent_fee_formatted
                    ));

    handler.listen( new goog.events.InputHandler(goog.dom.getElement(percent_fee_element_id)),
                    goog.events.InputHandler.EventType.INPUT,
                    goog.bind(this.doCalculateFees_, this,
                              withdraw_amount_element_id,
                              fixed_fee_element_id,
                              percent_fee_element_id,
                              withdraw_data['Currency'],
                              total_fees_element_id,
                              net_value_element_id,
                              true,    // opt_add_fees
                              false,   // opt_is_fixed_fee_in_satoshis
                              true,    // opt_is_fixed_fee_formatted
                              true,    // opt_is_amount_in_satoshis
                              false,   // opt_is_amount_formatted
                              true     //  opt_is_percent_fee_formatted
                    ));

    handler.listen( new goog.events.InputHandler(goog.dom.getElement(fixed_fee_element_id)),
                    goog.events.InputHandler.EventType.INPUT,
                    goog.bind(this.doCalculateFees_, this,
                              withdraw_amount_element_id,
                              fixed_fee_element_id,
                              percent_fee_element_id,
                              withdraw_data['Currency'],
                              total_fees_element_id,
                              net_value_element_id,
                              true,    // opt_add_fees
                              false,   // opt_is_fixed_fee_in_satoshis
                              true,    // opt_is_fixed_fee_formatted
                              true,    // opt_is_amount_in_satoshis
                              false,   // opt_is_amount_formatted
                              true     //  opt_is_percent_fee_formatted
                    ));


    handler.listen(feeDlg, goog.ui.Dialog.EventType.SELECT, function(e) {
      if (e.key == 'ok') {
        var form_data = bitex.util.getFormAsJSON(goog.dom.getFirstElementChild(feeDlg.getContentElement()));


        var percent_fee = form_data['PercentFee'];
        var pos = [0];
        var percent_fee_value = valueFormatter.parse(percent_fee, pos);
        if (isNaN(percent_fee_value)) {
          percent_fee_value = 0;
        }
        if (pos[0] != percent_fee.length || isNaN(percent_fee_value) || percent_fee_value < 0 ) {
          e.stopPropagation();
          e.preventDefault();
          return;
        }

        var fixed_fee = form_data['FixedFee'];
        pos = [0];
        var fixed_fee_value = valueFormatter.parse(fixed_fee, pos);
        if (isNaN(fixed_fee_value)) {
          fixed_fee_value = 0;
        }

        if (pos[0] != fixed_fee.length || isNaN(fixed_fee_value) || fixed_fee_value < 0 ) {
          e.stopPropagation();
          e.preventDefault();
          return;
        }
        fixed_fee_value = fixed_fee_value * 1e8;

        var requested_amount = (withdraw_data['Amount'] / ( 100.0 - withdraw_data['PercentFee'] ) * 100.0) + withdraw_data['FixedFee'];
        var original_fees = requested_amount -  withdraw_data['Amount'];

        var effective_amount = (withdraw_data['Amount'] / ( 100.0 - percent_fee_value ) * 100.0) + fixed_fee_value;
        var effective_fees = effective_amount -  withdraw_data['Amount'];

        if (original_fees < effective_fees) {
          // The broker tried to increase the amount of fees.
          e.stopPropagation();
          e.preventDefault();
          return;
        } else if (original_fees > effective_fees) {
          form_data['Fees'] = this.formatCurrency(original_fees / 1e8, withdraw_data['Currency'] , true) +
              '|' + this.formatCurrency(effective_fees / 1e8,withdraw_data['Currency'] , true);
        }

        delete form_data['Amount'];
        delete form_data['FixedFee'];
        delete form_data['PercentFee'];

        this.getBitexConnection().processWithdraw(request_id,
                                                  action,
                                                  withdraw_data['WithdrawID'],
                                                  undefined,  // opt_reason_id
                                                  undefined,  // opt_reason
                                                  form_data,  // opt_data
                                                  percent_fee_value, // opt_percent_fee
                                                  fixed_fee_value); // opt_fixed_fee

      }
    }, this);

  } else if (action === 'COMPLETE') {
    var dialogContent = bitex.templates.DepositWithdrawDialogContent({
      side: 'broker',
      currency: withdraw_data['Currency'],
      currencySign: this.getCurrencySign(withdraw_data['Currency']),
      force_method: withdraw_data['Method'],
      amount: withdraw_data['Amount'],
      methods: model.get('Profile')['WithdrawStructure'][withdraw_data['Currency'] ],
      methodID: method_element_id,
      showFeeDataEntry:false,
      amountID: withdraw_amount_element_id,
      fixedFeeID: fixed_fee_element_id,
      percentFeeID: percent_fee_element_id,
      totalFeesID: total_fees_element_id,
      netValueID: net_value_element_id,
      hideNetAmount:false
    });

    /**
     * @desc Crypto Currency Withdraw accordion title
     */
    var MSG_CURRENCY_BROKER_WITHDRAW_DIALOG_TITLE =
        goog.getMsg('Confirm {$currency} withdrawal', {currency :  this.getCurrencyDescription(withdraw_data['Currency']) });


    var dlg =  this.showDialog(dialogContent,
                               MSG_CURRENCY_BROKER_WITHDRAW_DIALOG_TITLE,
                               bootstrap.Dialog.ButtonSet.createOkCancel());


    handler.listen(dlg, goog.ui.Dialog.EventType.SELECT, function(e) {
      if (e.key == 'ok') {
        var broker_withdraw_data = bitex.util.getFormAsJSON(goog.dom.getFirstElementChild(dlg.getContentElement()));
        delete broker_withdraw_data['Amount'];

        this.getBitexConnection().processWithdraw(request_id,
                                                  action,
                                                  withdraw_data['WithdrawID'],
                                                  undefined,
                                                  undefined,
                                                  broker_withdraw_data);
      }
    }, this);
  }
};




/**
 * @param {goog.events.Event} e
 * @private
 */
bitex.app.BlinkTrade.prototype.onUserOrderEntry_ = function(e){
  /**
   * @desc notification for send order request
   */
  var MSG_SEND_ORDER_NOTIFICATION_TITLE = goog.getMsg('Sending order...');


  /**
   * @desc notification for send order request
   */
  var MSG_SEND_ORDER_NOTIFICATION_SIDE_BUY = goog.getMsg('BUY');


  /**
   * @desc notification for send order request
   */
  var MSG_SEND_ORDER_NOTIFICATION_SIDE_SELL = goog.getMsg('SELL');

  var side_msg =  MSG_SEND_ORDER_NOTIFICATION_SIDE_BUY;

  if (e.target.getSide() == '2') {
    side_msg = MSG_SEND_ORDER_NOTIFICATION_SIDE_SELL;
  }

  //
  // lets check if the user has available balance
  //
  if (!this.getModel().get('IsBroker')) {
    var balance_needed_to_send_the_order;
    var balance_currency;
    if (e.target.getSide() == '1') { // Buy
      balance_currency =  this.getPriceCurrencyFromSymbol(e.target.getSymbol());
      balance_needed_to_send_the_order = e.target.getPrice() * e.target.getAmount() / 1e8;
    } else if (e.target.getSide() == '2') {
      balance_currency =  this.getQtyCurrencyFromSymbol(e.target.getSymbol());
      balance_needed_to_send_the_order =  e.target.getAmount();
    }

    var broker_id = this.getModel().get('SelectedBrokerID');
    var client_id = this.getModel().get('UserID');

    var user_available_balance_for_trading = this.getAvailableBalanceForTrading(balance_currency);
    if (balance_needed_to_send_the_order > user_available_balance_for_trading) {
      var amount = Math.round(balance_needed_to_send_the_order - user_available_balance_for_trading);

      var instructions = [{
        'Timeout': 60,  // 60 seconds to deposit
        'Filter': {'PaidValue': amount},
        'Msg': {
          'MsgType': 'D',
          'ClOrdID': '' + new Date().getTime()  + '.L',
          'Symbol': e.target.getSymbol(),
          'Side': e.target.getSide(),
          'OrdType': '2', // Limited order
          'Price': e.target.getPrice(),
          'OrderQty': e.target.getAmount(),
          'BrokerID': e.target.getBrokerID()
        }
      }];

      var confirmDialogContent = bitex.templates.InsufficientFundsContentDialog({
        currencyDescription: this.getCurrencyDescription(balance_currency),
        balanceKey: broker_id + ':' + client_id + '_'  + balance_currency,
        depositFormattedBalance: this.formatCurrency(this.getDepositedAmount(balance_currency)/1e8, balance_currency, true),
        lockedFormattedBalance: this.formatCurrency(this.getLockedAmount(balance_currency)/1e8, balance_currency, true),
        availableFormattedBalance: this.formatCurrency(user_available_balance_for_trading/1e8, balance_currency, true)
      });

      /**
       * @desc dialog shown when the user doesn't have enough funds to buy/sell
       */
      var MSG_INSUFFICIENT_BALANCE_DIALOG_TITLE = goog.getMsg('Insufficient funds');

      /**
       * @desc dialog shown when the user doesn't have enough funds to buy/sell
       */
      var MSG_INSUFFICIENT_BALANCE_DEPOSIT_BUTTON_CAPTION = goog.getMsg('Deposit {$amount}', {
        amount: this.formatCurrency(amount/1e8, balance_currency, true)});


      var option_buttons = new bootstrap.Dialog.ButtonSet().
          addButton({
                       key: 'deposit',
                       caption: MSG_INSUFFICIENT_BALANCE_DEPOSIT_BUTTON_CAPTION
                    }, true, true).
          addButton(goog.ui.Dialog.ButtonSet.DefaultButtons.CANCEL, false, true);


      var dlgConfirm =  this.showDialog(confirmDialogContent,
                                        MSG_INSUFFICIENT_BALANCE_DIALOG_TITLE,
                                        option_buttons);

      var handler = this.getHandler();
      handler.listen(dlgConfirm, goog.ui.Dialog.EventType.SELECT, function(e) {
        if (e.key == 'deposit') {
          e.preventDefault();
          e.stopPropagation();

          var formatted_amount = new bitex.primitives.Price(amount, this.getCurrencyPip(balance_currency) ).format();

          this.showDepositDialog(balance_currency, (amount/1e8).toFixed(8), formatted_amount, false, instructions);
        }
      }, this);
      return;
    }
  }

  /**
   * @desc notification for send order request
   */
  var MSG_SEND_ORDER_NOTIFICATION_CONTENT = goog.getMsg('{$side} {$amount} {$symbol}  @ {$price}', {
    side: side_msg,
    amount: e.target.getAmount(),
    symbol: e.target.getSymbol(),
    price: e.target.getPrice()
  });

  this.showNotification( 'info', MSG_SEND_ORDER_NOTIFICATION_TITLE,MSG_SEND_ORDER_NOTIFICATION_CONTENT );

  this.conn_.sendLimitedOrder(e.target.getSymbol(),
                              e.target.getAmount(),
                              e.target.getPrice(),
                              e.target.getSide(),
                              e.target.getBrokerID(),
                              e.target.getClientID());
};

/**
 * @param {goog.events.Event} e
 * @private
 */
bitex.app.BlinkTrade.prototype.onUserCancelOrder_ = function(e){
  /**
   * @desc notification for order cancel request
   */
  var MSG_CANCEL_ORDER_NOTIFICATION_TITLE = goog.getMsg('Cancelling order...');

  if (goog.isDefAndNotNull(e.target.getClientOrderId())) {
    this.showNotification('info', MSG_CANCEL_ORDER_NOTIFICATION_TITLE, ':' + e.target.getClientOrderId() );
  } else {
    this.showNotification('info', MSG_CANCEL_ORDER_NOTIFICATION_TITLE, ':' + e.target.getOrderId() );
  }
  this.conn_.cancelOrder(e.target.getClientOrderId(), e.target.getOrderId());
};

/**
 * @param {goog.events.Event} e
 * @private
 */
bitex.app.BlinkTrade.prototype.onShowReceipt_ = function(e){
  var receiptData = e.target.getReceiptData();

  /**
   * @desc Crypto Currency Withdraw deposit title
   */
  var MSG_SHOW_DEPOSIT_RECEIPT_DIALOG_TITLE =
      goog.getMsg("Submission {$submissionid}", { submissionid : receiptData['SubmissionID'] });


  var dlg =  this.showDialog(bitex.templates.DepositReceiptDialogContent({depositReceiptList:receiptData['DepositReceipt']}),
                             MSG_SHOW_DEPOSIT_RECEIPT_DIALOG_TITLE,
                             bootstrap.Dialog.ButtonSet.createOk());
};

/**
 * @param {bitex.api.BitExEvent} e
 * @private
 */
bitex.app.BlinkTrade.prototype.onUpdateProfileResponse_ = function(e) {
  var msg = e.data;
  var new_profile = msg['Profile'];
  var model = this.getModel();
  model.set('SelectedCustomer', new_profile);
};

/**
 * @param {bitex.api.BitExEvent} e
 * @private
 */
bitex.app.BlinkTrade.prototype.onSuggestTrustedAddress_ = function(e){
  var msg = e.data;

  var model = this.getModel();
  if (!model.get('IsVerified')) {
    return;
  }

  /**
   * @desc Enable instant deposit dialog title
   */
  var MSG_ENABLE_INSTANT_DEPOSIT_DIALOG_TITLE =
      goog.getMsg('Enable {$currency} instant deposit?', {currency :  this.getCurrencyDescription(msg['Currency']) });


  var dlg =  this.showDialog(bitex.templates.ConfirmTrustedAddressContentDialog( {data: msg } ),
                             MSG_ENABLE_INSTANT_DEPOSIT_DIALOG_TITLE,
                             bootstrap.Dialog.ButtonSet.createYesNoCancel());

  var handler = this.getHandler();
  handler.listen(dlg, goog.ui.Dialog.EventType.SELECT, function(e) {
    if (e.key == 'yes') {
      e.preventDefault();
      e.stopPropagation();

      var address_label_el = goog.dom.getElementByClass('confirm-trusted-address-label', dlg.getContentElement());
      var label;

      if (goog.isDefAndNotNull(address_label_el)){
        label = goog.dom.forms.getValue(address_label_el);
      }

      this.conn_.confirmTrustedAddressRequest( msg['Address'], msg['Currency'], label );
    }

    dlg.dispose();
  }, this);
};

/**
 * @param {goog.events.Event} e
 * @private
 */
bitex.app.BlinkTrade.prototype.onUserShowQr_ = function(e){
  var qrData = e.target.getQrData();

  /**
   * @desc Crypto Currency Withdraw deposit title
   */
  var MSG_SHOW_QR_CURRENCY_DEPOSIT_DIALOG_TITLE =
      goog.getMsg('{$currency} deposit', {currency :  this.getCurrencyDescription(qrData['Currency']) });

  /**
   * @desc Crypto Currency Withdraw withdraw title
   */
  var MSG_SHOW_QR_CURRENCY_WITHDRAW_DIALOG_TITLE =
      goog.getMsg('{$currency} withdraw', {currency :  this.getCurrencyDescription(qrData['Currency']) });

  var dialog_title = MSG_SHOW_QR_CURRENCY_WITHDRAW_DIALOG_TITLE;
  if (e.target.getQrDataVerb() === 'DEPOSIT') {
    dialog_title = MSG_SHOW_QR_CURRENCY_DEPOSIT_DIALOG_TITLE;
  }

  var dlg =  this.showDialog(bitex.templates.CryptoCurrencyQRContentDialog({data:qrData }),
                             dialog_title,
                             bootstrap.Dialog.ButtonSet.createCancel());

  var handler = this.getHandler();
  var input_address =  qrData['Wallet'];
  handler.listenOnce(this.conn_ , bitex.api.BitEx.EventType.DEPOSIT_REFRESH, function(e){
    var refresh_msg = e.data;
    if (refresh_msg['Data']['InputAddress'] !== input_address ) {
      return;
    }
    if (goog.isDefAndNotNull( refresh_msg['Data']['Confirmations'] ) && refresh_msg['Data']['Confirmations']  == '0') {
      dlg.dispose();
    }
  });
};

/**
 * @param {goog.events.Event} e
 * @private
 */
bitex.app.BlinkTrade.prototype.onUserUploadReceipt_ = function(e){
  var model = this.getModel();
  var deposit_data = e.target.getDepositData();

  var broker = model.get('Broker');
  if (!goog.isDefAndNotNull(broker)){
    return;
  }

  var upload_form_url =  broker['UploadForm'];
  upload_form_url = upload_form_url.replace('{{UserID}}', model.get('UserID'));
  upload_form_url = upload_form_url.replace('{{Username}}', model.get('Username'));
  upload_form_url = upload_form_url.replace('{{BrokerID}}', model.get('Broker')['BrokerID']);
  upload_form_url = upload_form_url.replace('{{BrokerUsername}}', model.get('Broker')['ShortName']);
  upload_form_url = upload_form_url.replace('{{Email}}', model.get('Email'));
  upload_form_url = upload_form_url.replace('{{DepositMethod}}', deposit_data['DepositMethodName']);
  upload_form_url = upload_form_url.replace('{{ControlNumber}}', deposit_data['ControlNumber']);
  upload_form_url = upload_form_url.replace('{{DepositID}}', deposit_data['DepositID']);


  var form_src = upload_form_url;
  window.open(form_src,
              'blank',
              'scrollbars=yes,toolbar=no,width=700,height=500');
};

/**
 * @param {string} amount_element_id
 * @param {string} fixed_fee_element_id
 * @param {string} percent_fee_element_id
 * @param {string} currency
 * @param {string=} opt_fee_value_element_id
 * @param {string=} opt_net_amount_element_id
 * @param {boolean=} opt_add_fees.  Default to true
 * @param {boolean=} opt_is_fixed_fee_in_satoshis. Default to true
 * @param {boolean=} opt_is_fixed_fee_formatted. Default to true
 * @param {boolean=} opt_is_amount_in_satoshis. Default to false
 * @param {boolean=} opt_is_amount_formatted. Default to true
 * @param {boolean=} opt_is_percent_fee_formatted. Default to true
 * @private
 */
bitex.app.BlinkTrade.prototype.doCalculateFees_ = function(amount_element_id,
                                                           fixed_fee_element_id,
                                                           percent_fee_element_id,
                                                           currency,
                                                           opt_fee_value_element_id,
                                                           opt_net_amount_element_id,
                                                           opt_add_fees,
                                                           opt_is_fixed_fee_in_satoshis,
                                                           opt_is_fixed_fee_formatted,
                                                           opt_is_amount_in_satoshis,
                                                           opt_is_amount_formatted,
                                                           opt_is_percent_fee_formatted ){
  var add_fees = true;
  if (opt_add_fees === false) {
    add_fees = opt_add_fees;
  }
  var is_fixed_fee_in_satoshis = true;
  if (opt_is_fixed_fee_in_satoshis === false) {
    is_fixed_fee_in_satoshis = opt_is_fixed_fee_in_satoshis;
  }

  var is_fixed_fee_formatted = true;
  if (opt_is_fixed_fee_formatted === false) {
    is_fixed_fee_formatted = opt_is_fixed_fee_formatted;
  }

  var is_amount_in_satoshis = false;
  if (opt_is_amount_in_satoshis === true) {
    is_amount_in_satoshis = opt_is_amount_in_satoshis;
  }

  var is_amount_formatted = true;
  if (opt_is_amount_formatted === false) {
    is_amount_formatted = opt_is_amount_formatted;
  }

  var is_percent_fee_formatted = true;
  if (opt_is_percent_fee_formatted === false) {
    is_percent_fee_formatted = opt_is_percent_fee_formatted;
  }

  var valueFormatter = new goog.i18n.NumberFormat( goog.i18n.NumberFormat.Format.DECIMAL);

  var pos = [0];

  var raw_amount = goog.dom.forms.getValue( goog.dom.getElement(amount_element_id) );
  var amount = 0;
  if (is_amount_formatted) {
    pos = [0];
    amount = valueFormatter.parse(raw_amount , pos );
    if (pos[0] != raw_amount.length || isNaN(amount) || amount <= 0 ) {
      return;
    }
    if (isNaN(amount)) {
      amount = 0;
    }
  } else {
    amount = goog.string.toNumber(raw_amount);
  }
  if (!is_amount_in_satoshis) {
    amount = amount * 1e8;
  }


  var percent_fee = goog.dom.forms.getValue( goog.dom.getElement(percent_fee_element_id) );
  var percent_fee_value = 0.;
  if (is_percent_fee_formatted) {
    pos = [0];
    percent_fee_value = valueFormatter.parse(percent_fee, pos);
    if (isNaN(percent_fee_value)) {
      percent_fee_value = 0.;
    }
  } else {
    percent_fee_value = goog.string.toNumber(percent_fee);
  }


  var fixed_fee = goog.dom.forms.getValue( goog.dom.getElement(fixed_fee_element_id) );
  var fixed_fee_value = 0;
  if (is_fixed_fee_formatted) {
    pos = [0];
    fixed_fee_value = valueFormatter.parse(fixed_fee, pos);
    if (isNaN(fixed_fee_value)) {
      fixed_fee_value = 0;
    }
  } else {
    fixed_fee_value = goog.string.toNumber(fixed_fee);
  }
  if (!is_fixed_fee_in_satoshis) {
    fixed_fee_value = fixed_fee_value * 1e8;
  }



  var total_percent_fee_value = ((amount - fixed_fee_value) * ((percent_fee_value)/100.0));
  var total_fixed_fee_value = fixed_fee_value;
  var total_fees = total_percent_fee_value + total_fixed_fee_value;
  var net_amount = amount - total_fees;
  if (add_fees) {
    net_amount = (amount / ( 100. - percent_fee_value ) * 100) + total_fixed_fee_value;
    total_fees = amount - net_amount;
  }

  if (goog.isDefAndNotNull(opt_fee_value_element_id)) {
    var formatted_total_fee = this.formatCurrency(total_fees/1e8, currency, true);
    goog.dom.setTextContent( goog.dom.getElement(opt_fee_value_element_id) , formatted_total_fee);
  }
  if (goog.isDefAndNotNull(opt_net_amount_element_id)) {
    var formatted_net_amount = this.formatCurrency(net_amount/1e8, currency, true);
    goog.dom.setTextContent(goog.dom.getElement(opt_net_amount_element_id), formatted_net_amount);

    var net_amount_element_value_id = opt_net_amount_element_id + '_value';
    goog.dom.forms.setValue(goog.dom.getElement(net_amount_element_value_id), net_amount);
  }

  return [ amount, percent_fee_value, fixed_fee_value, net_amount ];
};

/**
 * @param {goog.events.Event} e
 * @private
 */
bitex.app.BlinkTrade.prototype.onProcessDeposit_ = function(e){
  var model = this.getModel();
  var deposit_data = e.target.getDepositData();
  var request_id = e.target.getRequestId();
  var action = e.target.getDepositAction();
  var handler = this.getHandler();

  if (action === 'CANCEL') {

    /**
     * @desc Cancel Deposit dialog title
     */
    var MSG_DEPOSIT_CANCEL_DIALOG_TITLE = goog.getMsg('Cancel deposit');

    var cancel_reason_dialog_content = bitex.templates.CancelDepositDialogContent({
      reason_id:'id_select_reason',
      custom_reason_id:'id_custom_reason_text'
    });

    var cancelWithdrawDlg =  this.showDialog( cancel_reason_dialog_content,
                                              MSG_DEPOSIT_CANCEL_DIALOG_TITLE,
                                              bootstrap.Dialog.ButtonSet.createOkCancel() );


    var select_reason_el = goog.dom.getElement('id_select_reason');
    var reason_el = goog.dom.getElement('id_custom_reason_text');
    handler.listen(select_reason_el, goog.events.EventType.CHANGE, function(e){
      var reason_id = goog.string.toNumber(goog.dom.forms.getValue( select_reason_el ));
      goog.style.showElement ( reason_el, (reason_id === 0 )) ;
    });

    handler.listen(cancelWithdrawDlg, goog.ui.Dialog.EventType.SELECT, function(e) {
      if (e.key == 'ok') {
        var reason_id = goog.string.toNumber(goog.dom.forms.getValue( select_reason_el ));
        var reason;

        if (reason_id === 0 ) {
          reason = goog.string.trim(goog.dom.forms.getValue(reason_el));

          if (goog.string.isEmpty(reason)) {
            e.stopPropagation();
            e.preventDefault();
            goog.dom.getElement('id_custom_reason_text').focus();
            return;
          }
        }

        this.getBitexConnection().processDeposit (request_id,
                                                  action,
                                                  undefined,
                                                  deposit_data['DepositID'],
                                                  reason_id,
                                                  reason);
      }
    }, this);
  } else if (action === 'PROGRESS') {
    this.getBitexConnection().processDeposit (request_id,
                                              action,
                                              undefined,
                                              deposit_data['DepositID']);

  } else if (action === 'COMPLETE') {
    var valueFormatter = new goog.i18n.NumberFormat( goog.i18n.NumberFormat.Format.DECIMAL);
    valueFormatter.setMaximumFractionDigits(8);
    valueFormatter.setMinimumFractionDigits(2);


    var paid_value_element_id = goog.string.getRandomString();
    var fixed_fee_element_id = goog.string.getRandomString();
    var percent_fee_element_id = goog.string.getRandomString();
    var total_fees_element_id = goog.string.getRandomString();
    var net_value_element_id = goog.string.getRandomString();

    var control_number  = deposit_data['ControlNumber'];
    if (deposit_data['Type'] == 'CRY') {
      control_number  = deposit_data['Data']['InputAddress'];
    }

    var confirm_deposit_dialog_content = bitex.templates.BrokerConfirmDepositContent({
      id_value:paid_value_element_id,
      fixedFeeID: fixed_fee_element_id,
      percentFeeID: percent_fee_element_id,
      totalFeesID: total_fees_element_id,
      netValueID: net_value_element_id,
      controlNumber:control_number ,
      currencySign:this.getCurrencySign(deposit_data['Currency']),
      value: valueFormatter.format(deposit_data['Value']/1e8),
      percentFee: valueFormatter.format(deposit_data['PercentFee']),
      fixedFee: valueFormatter.format(deposit_data['FixedFee']/1e8)
    });

    /**
     * @desc Dialog title to get deposit paid value
     */
    var MSG_DLG_TITLE_GET_DEPOSIT_PAID_VALUE = goog.getMsg('Confirm deposit');

    var confirmDepositDlg = this.showDialog(confirm_deposit_dialog_content,
                                            MSG_DLG_TITLE_GET_DEPOSIT_PAID_VALUE,
                                            bootstrap.Dialog.ButtonSet.createOkCancel());


    this.doCalculateFees_ (paid_value_element_id,
                           fixed_fee_element_id,
                           percent_fee_element_id,
                           deposit_data['Currency'],
                           total_fees_element_id,
                           net_value_element_id,
                           false,  // opt_add_fees
                           false,  // opt_is_fixed_fee_in_satoshis
                           true,   // opt_is_fixed_fee_formatted
                           false,  // opt_is_amount_in_satoshis
                           true,   // opt_is_amount_formatted
                           true   //  opt_is_percent_fee_formatted
    );

    handler.listen( new goog.events.InputHandler(goog.dom.getElement(paid_value_element_id) ),
        goog.events.InputHandler.EventType.INPUT,
        goog.bind(this.doCalculateFees_, this,
                  paid_value_element_id,
                  fixed_fee_element_id,
                  percent_fee_element_id,
                  deposit_data['Currency'],
                  total_fees_element_id,
                  net_value_element_id,
                  false,  // opt_add_fees
                  false,  // opt_is_fixed_fee_in_satoshis
                  true,   // opt_is_fixed_fee_formatted
                  false,  // opt_is_amount_in_satoshis
                  true,   // opt_is_amount_formatted
                  true   //  opt_is_percent_fee_formatted
        ));

    handler.listen( new goog.events.InputHandler(goog.dom.getElement(percent_fee_element_id) ),
        goog.events.InputHandler.EventType.INPUT,
        goog.bind(this.doCalculateFees_, this,
                  paid_value_element_id,
                  fixed_fee_element_id,
                  percent_fee_element_id,
                  deposit_data['Currency'],
                  total_fees_element_id,
                  net_value_element_id,
                  false,  // opt_add_fees
                  false,  // opt_is_fixed_fee_in_satoshis
                  true,   // opt_is_fixed_fee_formatted
                  false,  // opt_is_amount_in_satoshis
                  true,   // opt_is_amount_formatted
                  true   //  opt_is_percent_fee_formatted
        ));

    handler.listen( new goog.events.InputHandler(goog.dom.getElement(fixed_fee_element_id) ),
        goog.events.InputHandler.EventType.INPUT,
        goog.bind(this.doCalculateFees_, this,
                  paid_value_element_id,
                  fixed_fee_element_id,
                  percent_fee_element_id,
                  deposit_data['Currency'],
                  total_fees_element_id,
                  net_value_element_id,
                  false,  // opt_add_fees
                  false,  // opt_is_fixed_fee_in_satoshis
                  true,   // opt_is_fixed_fee_formatted
                  false,  // opt_is_amount_in_satoshis
                  true,   // opt_is_amount_formatted
                  true   //  opt_is_percent_fee_formatted
        ));

    handler.listen(confirmDepositDlg, goog.ui.Dialog.EventType.SELECT, function(e) {
      if (e.key == 'ok') {
        var pos = [0];
        var raw_paid_value = goog.dom.forms.getValue( goog.dom.getElement(paid_value_element_id) );

        var paid_value = valueFormatter.parse(raw_paid_value , pos );
        if (pos[0] != raw_paid_value.length || isNaN(paid_value) || paid_value <= 0 ) {
          e.stopPropagation();
          e.preventDefault();
          goog.dom.getElement(paid_value_element_id).focus();
          return;
        }
        paid_value = paid_value * 1e8;


        var percent_fee = goog.dom.forms.getValue( goog.dom.getElement(percent_fee_element_id) );
        pos = [0];
        var percent_fee_value = valueFormatter.parse(percent_fee, pos);
        if (isNaN(percent_fee_value)) {
          percent_fee_value = 0;
        }
        if (pos[0] != percent_fee.length || isNaN(percent_fee_value) || percent_fee_value < 0 ) {
          e.stopPropagation();
          e.preventDefault();
          goog.dom.getElement(percent_fee_element_id).focus();
          return;
        }

        var fixed_fee = goog.dom.forms.getValue( goog.dom.getElement(fixed_fee_element_id) );
        pos = [0];
        var fixed_fee_value = valueFormatter.parse(fixed_fee, pos);
        if (isNaN(fixed_fee_value)) {
          fixed_fee_value = 0;
        }

        if (pos[0] != fixed_fee.length || isNaN(fixed_fee_value) || fixed_fee_value < 0 ) {
          e.stopPropagation();
          e.preventDefault();
          goog.dom.getElement(fixed_fee_element_id).focus();
          return;
        }
        fixed_fee_value = fixed_fee_value * 1e8;

        this.getBitexConnection().processDeposit (request_id,
                                                  action,
                                                  undefined, // opt_secret
                                                  deposit_data['DepositID'],
                                                  undefined, // opt_reasonId
                                                  undefined, // opt_reason
                                                  paid_value, // opt_amount
                                                  percent_fee_value,
                                                  fixed_fee_value);

      }
    }, this);
  }
};

/**
 *
 * @param {string} currency
 * @param {number=} opt_amount
 * @param {string=} opt_formatted_amount
 * @param {boolean=} opt_switch_view  Defaults to true
 * @param {Object=} opt_instructions
 */
bitex.app.BlinkTrade.prototype.showDepositDialog = function(currency,
                                                            opt_amount,
                                                            opt_formatted_amount,
                                                            opt_switch_view,
                                                            opt_instructions) {
  var handler = this.getHandler();
  var user_verification_level = this.getModel().get('Profile')['Verified'];

  var switch_view = (opt_switch_view!==false);
  if (switch_view) {
    this.setView('deposit');
  }


  /**
   * @desc Crypto Currency Withdraw accordion title
   */
  var MSG_CURRENCY_DEPOSIT_DIALOG_TITLE =
      goog.getMsg('{$currency} deposit', {currency :  this.getCurrencyDescription(currency) });


  if (this.isCryptoCurrency(currency)) {

    var confirmDialogContent = bitex.templates.ConfirmDepositCryptoCurrencyContentDialog({
        currencydescription: this.getCurrencyDescription(currency)
      });

    var dlgConfirm =  this.showDialog(confirmDialogContent,
                                      MSG_CURRENCY_DEPOSIT_DIALOG_TITLE,
                                      bootstrap.Dialog.ButtonSet.createYesNoCancel());

    handler.listen(dlgConfirm, goog.ui.Dialog.EventType.SELECT, function(e) {
      if (e.key == 'yes') {
        e.preventDefault();
        e.stopPropagation();

        var request_id = parseInt( 1e7 * Math.random() , 10 );
        this.conn_.requestDeposit(
          request_id, undefined , opt_formatted_amount, undefined, currency, undefined, opt_instructions);

        goog.soy.renderElement(goog.dom.getFirstElementChild(dlgConfirm.getContentElement()),
                               bitex.templates.WaitingForDepositResponseDialogContent);

        dlgConfirm.setButtonSet( bootstrap.Dialog.ButtonSet.createCancel() );


        handler.listenOnce( this.conn_ , bitex.api.BitEx.EventType.ERROR_MESSAGE + '.' + request_id, function(e){
          dlgConfirm.dispose();
        });

        handler.listenOnce( this.conn_ , bitex.api.BitEx.EventType.DEPOSIT_RESPONSE + '.' + request_id, function(e){
          var msg = e.data;

          var enabled_instant_deposits = user_verification_level >= 3;

          var input_address = msg['Data']['InputAddress'];
          goog.soy.renderElement(goog.dom.getFirstElementChild(dlgConfirm.getContentElement()),
                                 bitex.templates.DepositCryptoCurrencyContentDialog, {
                                   deposit_message:msg,
                                   hasInstantDepositsEnabled:enabled_instant_deposits,
                                   amount: opt_amount,
                                   formattedAmount: opt_formatted_amount
                                 });


          handler.listen(this.conn_ , bitex.api.BitEx.EventType.DEPOSIT_REFRESH, function(e){
            var refresh_msg = e.data;
            if (refresh_msg['Data']['InputAddress'] !== input_address ) {
              return;
            }
            if (goog.isDefAndNotNull( refresh_msg['Data']['Confirmations'] ) && refresh_msg['Data']['Confirmations']  == '0') {
              dlgConfirm.dispose();
            }
          });
        }, this);
      }
    });
    return;
  }

  var value_fmt = new goog.i18n.NumberFormat(goog.i18n.NumberFormat.Format.DECIMAL);
  value_fmt.setMaximumFractionDigits(8);
  value_fmt.setMinimumFractionDigits(2);


  var deposit_methods = [];
  goog.array.forEach(this.getModel().get('DepositMethods'), function(deposit_method){
    if (deposit_method.currency == currency) {

      var deposit_method_limit;

      for (var x = user_verification_level; x>=0;x--) {
        deposit_method_limit = deposit_method.deposit_limits[ x ];
        if (goog.isDefAndNotNull(deposit_method_limit)) {
          break;
        }
      }

      var deposit_limit = { 'enabled':false };

      var has_limits_enabled_on_deposit_method = false;

      if ( goog.isDefAndNotNull(deposit_method_limit) && goog.isDefAndNotNull(deposit_method_limit['enabled'])) {
        has_limits_enabled_on_deposit_method = deposit_method_limit['enabled'];
      }

      if (has_limits_enabled_on_deposit_method) {
        deposit_limit['enabled'] = true;
        deposit_limit['min'] = deposit_method_limit['min'];
        deposit_limit['max'] = deposit_method_limit['max'];
        deposit_limit['formatted_min'] = this.formatCurrency(deposit_limit['min']/1e8, currency, true);
        deposit_limit['formatted_max'] = this.formatCurrency(deposit_limit['max']/1e8, currency, true);
        deposit_limit['formatted_min_value'] = value_fmt.format(deposit_limit['min']/1e8);
        deposit_limit['formatted_max_value'] = value_fmt.format(deposit_limit['max']/1e8);
      }

      var limits = {};
      limits['' + user_verification_level] = deposit_limit;
      if ( goog.isDefAndNotNull(deposit_limit) && deposit_limit['enabled']) {
        deposit_methods.push({
                               'method': deposit_method.id,
                               'description': deposit_method.description,
                               'disclaimer': deposit_method.disclaimer,
                               'percent_fee': deposit_method.percent_fee,
                               'fixed_fee': deposit_method.fixed_fee,
                               'limits': limits ,
                               'fields': []
                             });

      }
    }
  }, this);

  var method_element_id = goog.string.getRandomString();
  var amount_element_id = goog.string.getRandomString();
  var fixed_fee_element_id = goog.string.getRandomString();
  var percent_fee_element_id = goog.string.getRandomString();
  var total_fees_element_id = goog.string.getRandomString();
  var net_value_element_id = goog.string.getRandomString();


  var dialogContent = bitex.templates.DepositWithdrawDialogContent( {
                                                                      side: 'client',
                                                                      currency: currency,
                                                                      verificationLevel: user_verification_level,
                                                                      currencySign: this.getCurrencySign(currency),
                                                                      methods: deposit_methods,
                                                                      methodID: method_element_id,
                                                                      amountID: amount_element_id,
                                                                      showFeeDataEntry:false,
                                                                      amount:opt_amount,
                                                                      formattedAmount:opt_formatted_amount,
                                                                      fixedFeeID: fixed_fee_element_id,
                                                                      percentFeeID: percent_fee_element_id,
                                                                      totalFeesID: total_fees_element_id,
                                                                      netValueID: net_value_element_id,
                                                                      hideNetAmount:false
                                                                    });


  var dlg =  this.showDialog(dialogContent,
                             MSG_CURRENCY_DEPOSIT_DIALOG_TITLE,
                             bootstrap.Dialog.ButtonSet.createOkCancel());
  var deposit_form_uniform = new uniform.Uniform();
  deposit_form_uniform.decorate(  goog.dom.getFirstElementChild(dlg.getContentElement()) );

  goog.array.forEach( deposit_methods, function(deposit_method) {
    var method_id = deposit_method['method'];
    handler.listen( new goog.events.InputHandler(goog.dom.getElement(method_id + '_' + amount_element_id) ),goog.events.InputHandler.EventType.INPUT,function(e) {
      this.doCalculateFees_(
          method_id + '_' + amount_element_id,
          method_id + '_' + fixed_fee_element_id,
          method_id + '_' + percent_fee_element_id,
          currency,
          method_id + '_' + total_fees_element_id,
          method_id + '_' + net_value_element_id,
          false,  // opt_add_fees
          true,   // opt_is_fixed_fee_in_satoshis
          false,  // opt_is_fixed_fee_formatted
          false,  // opt_is_amount_in_satoshis
          true,   // opt_is_amount_formatted
          false   // opt_is_percent_fee_formatted
      );
    }, this);

    this.doCalculateFees_(
        method_id + '_' + amount_element_id,
        method_id + '_' + fixed_fee_element_id,
        method_id + '_' + percent_fee_element_id,
        currency,
        method_id + '_' + total_fees_element_id,
        method_id + '_' + net_value_element_id,
        false,  // opt_add_fees
        true,   // opt_is_fixed_fee_in_satoshis
        false,  // opt_is_fixed_fee_formatted
        false,  // opt_is_amount_in_satoshis
        true,   // opt_is_amount_formatted
        false   // opt_is_percent_fee_formatted
    );

  }, this );



  handler.listen(dlg, goog.ui.Dialog.EventType.SELECT, function(e) {
    if (e.key == 'ok') {
      e.preventDefault();
      e.stopPropagation();

      var deposit_form_el = goog.dom.getFirstElementChild(dlg.getContentElement());

      if (deposit_form_el.getAttribute('data-deposit-status') != 'prepare')  {
        dlg.dispose();
      } else {
        var error_list = deposit_form_uniform.validate();
        if (error_list.length > 0) {
          goog.array.forEach(error_list, function(error_msg) {
            this.showNotification( 'error', error_msg );
          }, this );

          e.stopPropagation();
          e.preventDefault();
          return;
        }

        var deposit_data = deposit_form_uniform.getAsJSON();
        var amount = deposit_data['Amount'];
        if (amount < 0) {
          amount = 0;
        }

        amount = amount * 1e8;

        var deposit_method_id = goog.string.toNumber(deposit_data['Method']);

        var request_id = parseInt( 1e7 * Math.random() , 10 );
        this.conn_.requestDeposit( request_id, deposit_method_id , amount);

        goog.soy.renderElement(dlg.getContentElement(),
                               bitex.templates.WaitingForDepositResponseDialogContent);


        handler.listenOnce( this.conn_ , bitex.api.BitEx.EventType.DEPOSIT_RESPONSE + '.' + request_id, function(e){
          var msg = e.data;
          goog.soy.renderElement(dlg.getContentElement(),
                                 bitex.templates.DepositSlipContentDialog,
                                 {deposit_id:msg['DepositID'], rest_url:this.rest_url_  });

          dlg.setButtonSet(bootstrap.Dialog.ButtonSet.createPrintOk() );

          handler.listen(dlg, goog.ui.Dialog.EventType.SELECT, function(e) {
            if (e.key == 'print') {
              window.open( this.rest_url_ + '/get_deposit?deposit_id=' +  msg['DepositID'] );
            }
          });
        });
      }
    }
  }, this);
};

/**
 * @param {goog.events.Event} e
 * @private
 */
bitex.app.BlinkTrade.prototype.onUserDepositRequest_ = function(e){
  var currency = e.target.getCurrency();
  this.showDepositDialog(currency);
};

/**
 * @param {goog.events.Event} e
 * @private
 */
bitex.app.BlinkTrade.prototype.onUserForgotPassword_ = function(e){
  this.conn_.forgotPassword( this.getModel().get('SelectedBrokerID'), e.target.getEmail());
  this.router_.setView('set_new_password');
};

/**
 * @param {goog.events.Event} e
 * @private
 */
bitex.app.BlinkTrade.prototype.onUserSetNewPassword_ = function(e){
  this.conn_.resetPassword(e.target.getToken() ,  e.target.getPassword() );
};



/**
 * @param {goog.events.Event} e
 * @private
 */
bitex.app.BlinkTrade.prototype.onUserEnableTwoFactor_ = function(e){
  var code = e.target.getCode();
  var has_code = !goog.string.isEmpty(code);
  var secret = "";
  if (has_code) {
    secret = this.getModel().get('TwoFactorSecret');
  }

  var req_id = parseInt(Math.random() * 1000000, 10);
  this.conn_.enableTwoFactor( true, secret, code, undefined, req_id );

  var handler = this.getHandler();
  handler.listenOnce(this.conn_, bitex.api.BitEx.EventType.TWO_FACTOR_SECRET + '.' +  req_id, function(e){
    var msg = e.data;
    if (has_code && !msg['TwoFactorEnabled']) {

      /**
       * @desc Error message when user missed the google authentication code
       */
      var MSG_ERROR_SETTING_TWO_FACTOR = goog.getMsg('Wrong authentication code. ' +
         'Please, make sure that you are using Google Authenticator and your cellphone time is exact synched with google servers.');

      this.showDialog(MSG_ERROR_SETTING_TWO_FACTOR);
    }
  }, this);
};

/**
 * @param {goog.events.Event} e
 * @private
 */
bitex.app.BlinkTrade.prototype.onUserDisableTwoFactor_ = function(e){
  this.conn_.enableTwoFactor( false );
};


/**
 * @param {goog.events.Event} e
 * @private
 */
bitex.app.BlinkTrade.prototype.onBodyClick_ =function(e){
  var element = e.target;

  var view_name = element.getAttribute('data-switch-view');
  if (goog.isDefAndNotNull(view_name)) {
    e.preventDefault();
    e.stopPropagation();

    this.router_.setView(view_name );
  }

  var model = this.getModel();
  var model_set_element;
  if (goog.dom.classes.has(e.target, 'model-action-set')){
    model_set_element = e.target;
  } else {
    model_set_element = goog.dom.getAncestorByClass(e.target, 'model-action-set');
  }
  if (goog.isDefAndNotNull(model_set_element)) {
    if ( goog.isDefAndNotNull(model_set_element.getAttribute('data-key'))) {
      model.set(model_set_element.getAttribute('data-key'),model_set_element.getAttribute('data-value'));
    }
  }
};

/**
 * @param {goog.events.Event} e
 * @private
 */
bitex.app.BlinkTrade.prototype.onBodyChange_ =function(e){
  if (goog.dom.classes.has( e.target, 'withdraw-method-selector' )) {
    var selected_method = goog.dom.forms.getValue( e.target );

    var elements = goog.dom.getElementsByClass( 'withdraw-method');

    goog.array.forEach(elements, function(element) {
      var method = element.getAttribute('data-withdraw-method');
      goog.style.showElement(element, method == selected_method );

      var field_elements = goog.dom.getElementsByClass('withdraw-field', element);
      goog.array.forEach(field_elements, function(element){
        element.disabled = (method != selected_method);
      });
    }, this);
  }
};

/**
 * @param {goog.events.Event} e
 * @private
 */
bitex.app.BlinkTrade.prototype.onUserLoginButtonClick_ = function(e){
  var username = e.target.getUsername();
  var password = e.target.getPassword();
  this.model_.set('Password',         e.target.getPassword() );

  this.conn_.login(this.getModel().get('SelectedBrokerID'),
                   username,
                   password);
};


/**
 * @param {bitex.api.BitExEvent} e
 */
bitex.app.BlinkTrade.prototype.onUserLoginOk_ = function(e) {
  var msg = e.data;

  goog.dom.classes.add( document.body, 'bitex-logged'  );
  goog.dom.classes.remove( document.body, 'bitex-not-logged' );

  this.getModel().set('UserID',           msg['UserID'] );
  this.getModel().set('PseudoName',       bitex.util.getPseudoName(msg['UserID']));
  this.getModel().set('Username',         msg['Username']);
  this.getModel().set('Email',            msg['Email']);
  this.getModel().set('TwoFactorEnabled', msg['TwoFactorEnabled']);
  this.getModel().set('IsBroker',         msg['IsBroker'] );
  this.getModel().set('IsVerified',       msg['Profile']['Verified'] > 1);

  var broker_currencies = new goog.structs.Set();
  var allowed_markets = {};
  var user_brokers = {};
  var broker_info;
  if (goog.isDefAndNotNull(msg['Broker'])) {
    broker_info = this.adjustBrokerData_(msg['Broker']);
    goog.object.extend(allowed_markets,  broker_info['AllowedMarkets']);
    broker_currencies.addAll(broker_info['BrokerCurrencies']);

    this.getModel().set('Broker', broker_info);


    user_brokers[ broker_info['BrokerID'] ] = broker_info;
    if (!msg['IsBroker'] ) {
      this.getModel().set('UserBrokers', user_brokers);
    }
  }

  var profile = msg['Profile'];
  if (msg['IsBroker'] ) {
    goog.dom.classes.add( document.body, 'bitex-broker');
    profile = this.adjustBrokerData_(profile);

    user_brokers[ profile['BrokerID'] ] = profile;
    this.getModel().set('UserBrokers', user_brokers);

    goog.object.extend(allowed_markets,  profile['AllowedMarkets']);
    broker_currencies.addAll(profile['BrokerCurrencies']);
  } else {
    goog.dom.classes.add( document.body, 'bitex-non-broker');

    if ( profile['Verified'] >= 2 ) {
        goog.style.showElement(goog.dom.$("verification_menu_id"), false);
    }
  }
  this.getModel().set('Profile',  profile);
  if (msg['IsBroker'] ) {
    this.getModel().set('SelectedBrokerID', this.getModel().get('Profile')['BrokerID']);
  } else if (goog.isDefAndNotNull(msg['Broker'])) {
    this.getModel().set('SelectedBrokerID', this.getModel().get('Broker')['BrokerID']);
  }

  this.getModel().set('AllowedMarkets', allowed_markets);
  this.getModel().set('BrokerCurrencies', broker_currencies.getValues() );

  var verification_data = profile['VerificationData'];
  if (profile['Verified'] >= 1) {
    try{
      if (goog.isDefAndNotNull(verification_data)){
        verification_data = goog.json.parse(verification_data);
      }
    }catch(e){}
  }
  this.getModel().set('VerificationData', verification_data);

  var verification_name = null;
  if (goog.isArray(verification_data)) {
    goog.array.forEach(verification_data, function(data){
      if (goog.isObject(data)) {
        if ( 'name' in data ) {
          verification_name = data['name'];
        }
      }
    });
  }
  this.getModel().set('VerificationName', verification_name);
  this.getModel().set('DisplayName', profile['Username']);
  if ( goog.isDefAndNotNull(verification_name))  {
    this.getModel().set('DisplayName', verification_name['first'] + ' ' + verification_name['last']);
  }


  if (goog.isDefAndNotNull($zopim) && goog.isDefAndNotNull($zopim.livechat)) {
    var tags = 'VerificationLevel:';
    switch(profile['Verified']) {
      case 0:
        tags += 'no';
        break;
      case 1:
        tags += 'pending';
        break;
      case 2:
        tags += 'processing';
        break;
      default:
        tags += profile['Verified'] - 2;
        break;
    }
    tags += ', TwoFactorEnabled:' + profile['TwoFactorEnabled'];
    tags += ', UserID:' + profile['ID'];
    tags += ', NeedWithdrawEmail:' + profile['NeedWithdrawEmail'];
    tags += ', TransactionFeeBuy:' + profile['TransactionFeeBuy'];
    tags += ', TransactionFeeSell:' + profile['TransactionFeeSell'];

    if (  this.getModel().get('DisplayName') != this.getModel().get('Username') )  {
      tags += ', Username:' + this.getModel().get('Username');
    }

    $zopim.livechat.setName( this.getModel().get('DisplayName') );
    $zopim.livechat.setEmail(profile['Email']);
    $zopim.livechat.addTags(tags);
  }


  this.conn_.requestBalances();
  if (msg['IsBroker'] ) {
    if (goog.isDefAndNotNull( this.getModel().get('Profile')['Accounts'] )) {
      goog.object.forEach( this.getModel().get('Profile')['Accounts'], function(account_data) {
        this.conn_.requestBalances(account_data[0]);
      }, this);
    }
  }

  // Request Deposit Options
  this.conn_.requestDepositMethods();

  if (this.getModel().get('IsVerified')) {
    this.router_.setView('offerbook');
  } else {
    if (this.getModel().get('Profile')['Verified']==0) {
      this.router_.setView('verification');
    } else {
      this.router_.setView('offerbook');
    }
  }

  // Request Open Orders
  this.getModel().set('FinishedInitialOpenOrdersRequest',  false);
  this.conn_.requestOrderList(this.open_orders_request_id_ , 0, 100, ['0', '1'] );
};

/**
 * @param {bitex.api.BitExEvent} e
 */
bitex.app.BlinkTrade.prototype.onUserLoginError_ = function(e) {
  goog.dom.classes.add( document.body, 'bitex-not-logged'  );
  goog.dom.classes.remove( document.body, 'bitex-logged' );
  goog.dom.classes.remove( document.body, 'bitex-broker' );
  goog.dom.classes.remove( document.body, 'bitex-non-broker');

  var msg = e.data;

  this.model_.set('UserID', '');
  this.model_.set('Username', '');


  /**
   * @desc google authentication dialog title
   */
  var MSG_TWO_STEPS_AUTHENTICATION_DIALOG_TITLE = goog.getMsg('2 steps authentication');

  if (msg['NeedSecondFactor']) {
    var dlg_content = bitex.templates.GoogleAuthenticationCodeDialogContent();

    var dlg_ = this.showDialog(dlg_content,
                               MSG_TWO_STEPS_AUTHENTICATION_DIALOG_TITLE,
                               bootstrap.Dialog.ButtonSet.createOkCancel() );
    var gauth_uniform = new uniform.Uniform();
    gauth_uniform.decorate(goog.dom.getFirstElementChild(dlg_.getContentElement()));

    var handler = this.getHandler();
    handler.listen(dlg_, goog.ui.Dialog.EventType.SELECT, function(e) {
      if (e.key == 'ok') {
        var error_list = gauth_uniform.validate();
        if (error_list.length > 0) {
          goog.array.forEach(error_list, function(error_msg) {
            this.showNotification( 'error', error_msg );
          }, this );

          e.stopPropagation();
          e.preventDefault();
        } else {
          var second_factor = gauth_uniform.getAsJSON()['token'];
          this.conn_.login( this.getModel().get('SelectedBrokerID'),
                            this.loginView_.getUsername(),
                            this.loginView_.getPassword(),
                            second_factor );

          dlg_.dispose();
        }
      }
    });

  } else {

    /**
     * @desc Invalid Password error
     */
    var MSG_LOGIN_ERROR_INVALID_PASSWORD = goog.getMsg('Invalid password');

    /**
     * @desc Invalid Password error
     */
    var MSG_LOGIN_ERROR_INVALID_USERNAME_OR_PASSWORD = goog.getMsg('Invalid username or password');

    /**
     * @desc Invalid second step auth error
     */
    var MSG_LOGIN_ERROR_INVALID_SECOND_STEP = goog.getMsg('Invalid second step authentication code');

    /**
     * @desc Invalid second step auth error
     */
    var MSG_LOGIN_ERROR_INVALID_BROKER = goog.getMsg('Invalid Broker');

    /**
     * @desc Invalid second step auth error
     */
    var MSG_LOGIN_ERROR_USERNAME_ALREADY_TAKEN = goog.getMsg('Username or email already taken');

    var user_status_text = msg['UserStatusText'];
    switch(msg['UserStatusText']) {
      case 'MSG_LOGIN_ERROR_INVALID_PASSWORD':
        user_status_text = MSG_LOGIN_ERROR_INVALID_PASSWORD;
        break;
      case 'MSG_LOGIN_ERROR_INVALID_USERNAME_OR_PASSWORD':
        user_status_text = MSG_LOGIN_ERROR_INVALID_USERNAME_OR_PASSWORD;
        break;
      case 'MSG_LOGIN_ERROR_INVALID_SECOND_STEP':
        user_status_text = MSG_LOGIN_ERROR_INVALID_SECOND_STEP;
        break;
      case 'MSG_LOGIN_ERROR_INVALID_BROKER':
        user_status_text = MSG_LOGIN_ERROR_INVALID_BROKER;
        break;
      case 'MSG_LOGIN_ERROR_USERNAME_ALREADY_TAKEN':
        user_status_text = MSG_LOGIN_ERROR_USERNAME_ALREADY_TAKEN;
        break;
    }

    this.showDialog( user_status_text );
  }
};

/**
 * @param {goog.events.Event} e
 * @private
 */
bitex.app.BlinkTrade.prototype.onUserSignupButton_ = function(e) {

  this.model_.set('Password',         e.target.getPassword() );

  this.conn_.signUp( e.target.getUsername(),
                     e.target.getPassword(),
                     e.target.getEmail(),
                     e.target.getState(),
                     e.target.getCountry(),
                     e.target.getBroker());
};

/**
 * return {bitex.model.Model}
 */
bitex.app.BlinkTrade.prototype.getModel = function() {
  return this.model_;
};

/**
 * return Heart Beat Interval
 */
bitex.app.BlinkTrade.prototype.getHeartBtInt = function() {
  return 30000;
};


bitex.app.BlinkTrade.prototype.onBeforeSetView_ = function(e){
  var view_id = e.view_id;
  var view = e.view;

  if (view_id == 'admin') {
    this.getModel().set('SelectedBrokerID', 8999999 );
  }

  if (!view.isInDocument()) {
    view.decorate(goog.dom.getElement(view_id));
  }

  if (! this.conn_.isLogged()) {
    switch(view_id) {
      case 'start':
      case 'admin':
      case 'signin':
      case 'signup':
      case 'faq':
      case 'forgot_password':
      case 'set_new_password':
      case 'broker_application':
        break;
      case 'market':
      case 'ranking':
        if ( !this.conn_.isConnected() ) {
          this.router_.setView('start');
        }
        break;

      default:
        // redirect non-logged users to the signin page
        this.router_.setView('start');
        return false;
    }
  }

  // remove any active view classes from document body
  var classes = goog.dom.classes.get(document.body );
  var classes_to_remove = [];
  goog.array.forEach( classes, function( cls ) {
    if (goog.string.startsWith(cls, 'active-view-' ) ){
      classes_to_remove.push(cls);
    }
  });
  goog.array.forEach( classes_to_remove, function( cls ) {
    goog.dom.classes.remove( document.body, cls );
  });

  document.body.scrollTop = 0;

  // set the current view
  goog.dom.classes.add( document.body, 'active-view-' + view_id );
  document.body.setAttribute('data-active-view', view_id);

  goog.array.forEach( goog.dom.getElementsByClass('bitex-view'), function(view_el) {
    var element_view_name = view_el.getAttribute('data-view-name');
    if (!goog.isDefAndNotNull(element_view_name)){
      element_view_name = view_el.id;
    }

    if (element_view_name === view_id) {
      goog.dom.classes.add( view_el, 'bitex-view-active' );

      if ( !goog.dom.classes.has(view_el, 'bitex-view-always-show') ) {
        if ( !goog.dom.classes.has(view_el, 'bitex-view-' + view_id) ) {
            goog.style.showElement ( view_el, true);
        } else {
          goog.style.showElement( view_el, false);
        }
      }
    } else {
      goog.dom.classes.remove( view_el, 'bitex-view-active' );
      if (!goog.dom.classes.has(view_el, 'bitex-view-always-show') ) {
        if ( goog.dom.classes.has(view_el, 'bitex-view-' + view_id) ) {
          goog.style.showElement ( view_el, true);
        } else {
          goog.style.showElement ( view_el, false);
        }
      }
    }
  }, this);
};

/**
 *
 * @param {string} country
 * @param {string=} opt_state
 * @return {Array.<Object>}
 */
bitex.app.BlinkTrade.prototype.getBrokersByCountry = function(country, opt_state) {
  var response = [];

  var query = country;
  if (goog.isDefAndNotNull(opt_state)) {
    query += '_' + opt_state;
  }

  var brokers = this.getModel().get('BrokerList');
  if (goog.isDefAndNotNull(brokers)) {
    goog.array.forEach(brokers, function(broker){
      var broker_accept_array = broker['AcceptCustomersFrom'][0];
      var broker_reject_array = broker['AcceptCustomersFrom'][1];

      var is_explicit_accepted = goog.array.findIndex( broker_accept_array, function(accept_data){
        return (accept_data === query || accept_data === country);
      }) >= 0;

      var is_accepted = is_explicit_accepted ||  (broker_accept_array[0] === "*" );

      var is_explicit_rejected = goog.array.findIndex( broker_reject_array, function(accept_data){
        return (accept_data === query || accept_data === country);
      }) >= 0;

      var is_rejected = is_explicit_rejected ||  (broker_reject_array[0] === "*" );

      if (is_explicit_accepted) {
        response.push(broker);
      } else if (is_accepted && !is_rejected ) {
        response.push(broker);
      }
    });
  }


  return response;
};

/**
 * @param {number} amount
 * @param {string} currency_code
 * @param {boolean=} opt_human
 */
bitex.app.BlinkTrade.prototype.formatCurrency  =   function(amount, currency_code, opt_human) {
  /**
   * @type {bitex.model.OrderBookCurrencyModel}
   */
  var currency_def = this.currency_info_[currency_code];
  var formatter;
  if (goog.isDefAndNotNull(opt_human) && opt_human === true) {
    formatter = new goog.i18n.NumberFormat( currency_def.human_format, currency_def.code );
  } else {
    formatter = new goog.i18n.NumberFormat( currency_def.format, currency_def.code );
  }
  return formatter.format(amount);
};

/**
 * @param {string} currency_code
 * @return {boolean}
 */
bitex.app.BlinkTrade.prototype.isCryptoCurrency  =   function(currency_code) {
  /**
   * @type {bitex.model.OrderBookCurrencyModel}
   */
  var currency_def = this.currency_info_[currency_code];
  return currency_def.is_crypto;
};

/**
 * @param {string} currency_code
 * @return {string}
 */
bitex.app.BlinkTrade.prototype.getCurrencySign  =   function(currency_code) {
  /**
   * @type {bitex.model.OrderBookCurrencyModel}
   */
  var currency_def = this.currency_info_[currency_code];
  return currency_def.sign;
};

/**
 * @param {string} currency_code
 * @return {string}
 */
bitex.app.BlinkTrade.prototype.getCurrencyPip =   function(currency_code) {
  /**
   * @type {bitex.model.OrderBookCurrencyModel}
   */
  var currency_def = this.currency_info_[currency_code];
  return currency_def.pip;
};

/**
 * @param {string} currency_code
 * @return {string}
 */
bitex.app.BlinkTrade.prototype.getCurrencyFormat  =   function(currency_code) {
  /**
   * @type {bitex.model.OrderBookCurrencyModel}
   */
  var currency_def = this.currency_info_[currency_code];
  return currency_def.format;
};

/**
 * @param {string} currency_code
 * @return {string}
 */
bitex.app.BlinkTrade.prototype.getCurrencyHumanFormat  =   function(currency_code) {
  /**
   * @type {bitex.model.OrderBookCurrencyModel}
   */
  var currency_def = this.currency_info_[currency_code];
  return currency_def.human_format;
};

/**
 * @param {string} currency_code
 * @return {string}
 */
bitex.app.BlinkTrade.prototype.getCurrencyDescription  =   function(currency_code) {
  /**
   * @type {bitex.model.OrderBookCurrencyModel}
   */
  var currency_def = this.currency_info_[currency_code];
  return currency_def.description;
};

/**
 * @param {bitex.api.BitExEvent} e
 * @private
 */
bitex.app.BlinkTrade.prototype.onSecurityList_ =   function(e) {
  var msg = e.data;

  goog.array.forEach(msg['Currencies'], function( currency) {
    this.currency_info_[ currency['Code'] ] = {
      code: currency['Code'],
      format: currency['FormatJS'],
      human_format: currency['HumanFormatJS'],
      description : currency['Description'],
      sign : currency['Sign'],
      pip : currency['Pip'],
      is_crypto : currency['IsCrypto']
    };

  }, this);

  var symbols = [];
  goog.array.forEach(msg['Instruments'], function( instrument) {
    var symbol = instrument['Symbol'];

    this.all_markets_[symbol]  = {
      'symbol': symbol,
      'description': instrument['Description']
    };

    symbols.push( symbol );

    var currency_key = instrument['Symbol'];
    var volume_buy_key = 'volume_buy_' +  currency_key;
    var volume_sell_key = 'volume_sell_' +  currency_key;
    var min_key = 'min_' +  currency_key;
    var max_key = 'max_' +  currency_key;
    var avg_key = 'avg_' +  currency_key;
    var bid_key = 'best_bid_' +  currency_key;
    var offer_key = 'best_offer_' +  currency_key;
    var last_price = 'last_price_' +  currency_key;

    this.model_.set('formatted_' + volume_sell_key, this.formatCurrency(0,  symbol.substr(0,3), true ), true );
    this.model_.set('formatted_' + volume_buy_key, this.formatCurrency(0,  instrument['Currency'], true ), true );
    this.model_.set('formatted_' + min_key, this.formatCurrency(0, instrument['Currency'], true) , true);
    this.model_.set('formatted_' + max_key, this.formatCurrency(0, instrument['Currency'], true), true);
    this.model_.set('formatted_' + avg_key, this.formatCurrency(0, instrument['Currency'], true), true);
    this.model_.set('formatted_' + bid_key, this.formatCurrency(0, instrument['Currency'], true), true);
    this.model_.set('formatted_' + offer_key, this.formatCurrency(0, instrument['Currency'], true), true);
    this.model_.set('formatted_' + last_price, this.formatCurrency(0, instrument['Currency'], true), true);
  }, this );

  this.model_.set('SecurityList', msg);
};

/**
 * @param {Object} broker_info
 * @return {Object}
 * @private
 */
bitex.app.BlinkTrade.prototype.adjustBrokerData_ = function(broker_info) {
  var percent_fmt = new goog.i18n.NumberFormat(goog.i18n.NumberFormat.Format.PERCENT);
  percent_fmt.setMaximumFractionDigits(2);
  percent_fmt.setMinimumFractionDigits(2);

  var value_fmt = new goog.i18n.NumberFormat(goog.i18n.NumberFormat.Format.DECIMAL);
  value_fmt.setMinimumFractionDigits(2);
  value_fmt.setMaximumFractionDigits(8);

  broker_info['Currencies'] = broker_info['Currencies'].split(',');
  if (broker_info['Currencies'].length === 1 && goog.string.isEmpty(broker_info['Currencies'][0])) {
    broker_info['Currencies'] = [];
  }

  goog.object.forEach(broker_info['WithdrawStructure'], function(currency_withdraw_structures, currency_code){
    goog.array.forEach(currency_withdraw_structures, function(currency_withdraw_structure, currency_withdraw_structure_index) {
      currency_withdraw_structure['formatted_fixed_fee'] =
          this.formatCurrency(currency_withdraw_structure['fixed_fee'] / 1e8 ,currency_code,true );

      currency_withdraw_structure['formatted_percent_fee'] = percent_fmt.format(currency_withdraw_structure['percent_fee']);

      goog.object.forEach( currency_withdraw_structure['limits'], function(limits, verification_level) {
        if (goog.isDefAndNotNull(limits['max'])) {
          limits['formatted_max'] = this.formatCurrency(limits['max'] / 1e8 ,currency_code,true );
          limits['formatted_max_value'] = value_fmt.format(limits['max'] / 1e8 );

        }
        if (goog.isDefAndNotNull(limits['min'])) {
          limits['formatted_min'] = this.formatCurrency(limits['min'] / 1e8,currency_code,true );
          limits['formatted_min_value'] = value_fmt.format(limits['min'] / 1e8 );
        }
      }, this );
    }, this);
  }, this );


  var allowed_markets = {};
  var broker_currencies = goog.array.clone(broker_info['Currencies']);
  goog.array.forEach( broker_info['CryptoCurrencies'], function(crypto_currency){
    broker_currencies.push(crypto_currency['CurrencyCode']);


    var market_crypto_currency = goog.object.findKey( this.all_markets_, function(market_info, symbol) {
      if (symbol.indexOf(crypto_currency['CurrencyCode']) >= 0)  {
        return true;
      }
    });

    if (goog.isDefAndNotNull(market_crypto_currency)) {
      goog.array.forEach( broker_info['Currencies'], function(currency) {
        var market_currency = goog.object.findKey( this.all_markets_, function(market_info, symbol) {
          if (symbol.indexOf(currency) >= 0)  {
            return true;
          }
        });
        if (goog.isDefAndNotNull(market_currency)) {
          allowed_markets[market_currency] = this.all_markets_[market_currency];
        }
      },this);
    }
  },this);
  broker_info['BrokerCurrencies'] = broker_currencies;
  broker_info['AllowedMarkets'] = allowed_markets;
  broker_info['FormattedTransactionFeeBuy'] = percent_fmt.format(broker_info['TransactionFeeBuy'] / 10000);
  broker_info['FormattedTransactionFeeSell'] = percent_fmt.format(broker_info['TransactionFeeSell'] / 10000);

  return broker_info;
};

/**
 * @param {bitex.api.BitExEvent} e
 * @private
 */
bitex.app.BlinkTrade.prototype.onBrokerListResponse_ =  function(e){
  var msg = e.data;

  var broker_list = [];
  goog.array.forEach(msg['BrokerListGrp'], function( broker_array )  {
    var broker_info = {};
    goog.array.forEach(msg['Columns'], function( column, index )  {
      broker_info[column] = broker_array[index];
    }, this);

    /**
     * @desc label for broker selection on signup form
     */
    var MSG_APPLY_TO_BE_BROKER = goog.getMsg('Apply to be a broker');

    /**
     * @desc label for broker selection on signup form
     */
    var MSG_NOTIFY_ME_WHEN_A_NEW_BROKER_ARRIVE = goog.getMsg('Notify me when a new broker arrive in my region');

    switch(broker_info['SignupLabel']) {
      case '{MSG_BROKER_APPLY}':
        broker_info['SignupLabel'] = MSG_APPLY_TO_BE_BROKER;
        break;

      case '{MSG_NOTIFY_NEW_BROKER}':
        broker_info['SignupLabel'] = MSG_NOTIFY_ME_WHEN_A_NEW_BROKER_ARRIVE;
        break;
    }

    broker_info = this.adjustBrokerData_(broker_info);
    broker_list.push(broker_info);
  }, this );


  this.model_.set('BrokerList', broker_list);
};

/**
 * @param {goog.events.Event} e
 * @protected
 */
bitex.app.BlinkTrade.prototype.onUserConnectBitEx_ = function(e){
  this.connectBitEx();
};

/**
 * @param {goog.events.Event} e
 * @protected
 */
bitex.app.BlinkTrade.prototype.onConnectionOpen_ = function(e){
  var just_now = new Date(Date.now());

  goog.dom.classes.remove( document.body, 'ws-not-connected' );
  goog.dom.classes.add( document.body, 'ws-connected' );
  goog.dom.classes.remove( document.body, 'bitex-broker' );
  goog.dom.classes.remove( document.body, 'bitex-non-broker' );

  if (! goog.isDefAndNotNull(this.model_.get('SecurityList') )) {
    this.conn_.requestSecurityList();
  }

  if (! goog.isDefAndNotNull(this.model_.get('BrokerList') )) {
    this.conn_.requestBrokerList();
  }

  // auto login in case of the user reconnecting
  var username = this.getModel().get('Username');
  var password = this.getModel().get('Password');
  if (goog.isDefAndNotNull(username) && goog.isDefAndNotNull(password)) {
    if (!goog.string.isEmpty(username) && !goog.string.isEmpty(password) ) {
      if (password.length >= 8 ) {
        this.conn_.login(this.getModel().get('SelectedBrokerID'),username, password);
      }
    }
  }

  this.conn_.testRequest();
};

/**
 * @param {goog.events.Event} e
 * @private
 */
bitex.app.BlinkTrade.prototype.onTestRequestTimer_ = function(e){
  if (goog.isDefAndNotNull(this.conn_) && this.conn_.isConnected()) {
    this.getBitexConnection().testRequest();
  }

  this.test_request_deadline_timer_ = new goog.Timer(this.maximum_allowed_delay_in_ms_);
  this.test_request_deadline_timer_.start();

  this.getHandler().listenOnce(this.test_request_deadline_timer_, goog.Timer.TICK, function(e){
    location.reload();
  });
};


/**
 * @param {goog.events.Event} e
 * @private
 */
bitex.app.BlinkTrade.prototype.onHearbeat_ = function(e) {
  var msg = e.data;
  if (goog.isDefAndNotNull(this.test_request_deadline_timer_)) {
    this.test_request_deadline_timer_.stop();
    this.test_request_deadline_timer_ = null;
  }

  if (goog.isDefAndNotNull(msg['SendTime'])) {
    var sent = new Date(msg['SendTime']);
    var just_now = new Date(Date.now());

    this.getModel().set('latency', just_now - sent );
  }
};


/**
 * @param {goog.events.Event} e
 * @protected
 */
bitex.app.BlinkTrade.prototype.onConnectionClose_ = function(e){
  goog.dom.classes.add( document.body, 'ws-not-connected','bitex-not-logged'  );
  goog.dom.classes.remove( document.body, 'ws-connected' , 'bitex-logged' );
  goog.dom.classes.remove( document.body, 'bitex-broker' );
  goog.dom.classes.remove( document.body, 'bitex-non-broker' );

  this.router_.setView('start');
};

/**
 * @param {goog.events.Event} e
 * @protected
 */
bitex.app.BlinkTrade.prototype.onConnectionError_ = function(e){
  goog.dom.classes.add( document.body, 'ws-not-connected','bitex-not-logged'  );
  goog.dom.classes.remove( document.body, 'ws-connected' , 'bitex-logged' );
  goog.dom.classes.remove( document.body, 'bitex-broker' );
  goog.dom.classes.remove( document.body, 'bitex-non-broker' );

  /**
   * @desc notification title on Connection close
   */
  var MSG_CONNECTION_ERROR_NOTIFICATION_ERROR_TITLE = goog.getMsg('Error');


  /**
   * @desc notification content on Connection close
   */
  var MSG_CONNECTION_ERROR_NOTIFICATION_ERROR_CONTENT = goog.getMsg('detected with the connection.');

  this.showNotification('error',
                        MSG_CONNECTION_ERROR_NOTIFICATION_ERROR_TITLE,
                        MSG_CONNECTION_ERROR_NOTIFICATION_ERROR_CONTENT);

  this.router_.setView('start');
};

/**
 * @param {bitex.api.BitExEvent} e
 * @protected
 */
bitex.app.BlinkTrade.prototype.onConnectionErrorMessage_ = function(e){
  var msg = e.data;

  /**
   * @desc notification content on Connection close
   */
  var MSG_CONNECTION_ERROR_MESSAGE_NOTIFICATION_TITLE = goog.getMsg('Message from server:');

  this.showNotification('error',
                        MSG_CONNECTION_ERROR_MESSAGE_NOTIFICATION_TITLE,
                        msg['Description'] + ' - ' + msg['Detail'],
                        this.error_message_alert_timeout_);
};



/**
 * @param {string} content
 * @param {string} opt_title
 * @param {goog.ui.Dialog.ButtonSet?} opt_button_set The button set to use.
 * @return {bootstrap.Dialog}
 */
bitex.app.BlinkTrade.prototype.showDialog = function(content, opt_title, opt_button_set) {
  /**
   * @desc Connection error dialog title
   */
  var MSG_CONNECTION_ERROR_DEFAULT_DIALOG_TITLE = goog.getMsg('Error');
  var title = opt_title || MSG_CONNECTION_ERROR_DEFAULT_DIALOG_TITLE ;

  var buttonSet = opt_button_set || bootstrap.Dialog.ButtonSet.createOk();

  if (goog.isDefAndNotNull(this.dialog_)) {
    this.dialog_.dispose();
    this.dialog_ = null;
  }

  this.dialog_ = new bootstrap.Dialog();
  this.dialog_.setTitle(title);
  this.dialog_.setContent(content);
  this.dialog_.setButtonSet( buttonSet);
  this.dialog_.setVisible(true);

  return this.dialog_;
};

/**
 * @param {string} type
 * @param {string} title
 * @param {string} content
 * @param {number} opt_display_time.  Defaults to 3000 milliseconds
 */
bitex.app.BlinkTrade.prototype.showNotification = function(type , title, content,  opt_display_time) {
  var display_time = 3000;
  if (type == 'error') {
    display_time *= 3;
  }
  if ( goog.isNumber(opt_display_time) ) {
    display_time = opt_display_time;
  }

  var alert_content = goog.dom.createDom( 'span', undefined,
    [goog.dom.createDom( 'strong', undefined, title), ' ', content ] );

  var notification = new bootstrap.Alert(type, alert_content, true );

  notification.render( goog.dom.getElement('id_notifications') );

  if (display_time > 0) {
    var handler = this.getHandler();

    goog.Timer.callOnce(function(e){
      var anim = new goog.fx.dom.FadeOutAndHide(notification.getElement(), 200);
      handler.listenOnce(anim, goog.fx.Transition.EventType.END, function(e) {
        notification.dispose();
        anim.dispose();
      });
      anim.play();
    }, display_time, this);
  }
};

/**
 * @param {string} algo_instance_id
 */
bitex.app.BlinkTrade.prototype.registerAlgorithmInstance = function(algo_instance_id) {
  var handler = this.getHandler();

  /**
   * @desc starting algorithm notification message
   */
  var MSG_STARTING_ALGORITHM_NOTIFICATION = goog.getMsg('starting algorithm ....');
  this.showNotification('info', MSG_STARTING_ALGORITHM_NOTIFICATION);


  handler.listen(this.getModel(), bitex.model.Model.EventType.SET + algo_instance_id + '_params' , this.onAlgoParams_);
  handler.listen(this.getModel(), bitex.model.Model.EventType.SET + algo_instance_id + '_status',  this.onAlgoStatusChange_);

  var params          = this.getModel().get( algo_instance_id + '_params');
  var algo            = this.getModel().get( algo_instance_id + '_algo');
  var symbol          = this.getModel().get( algo_instance_id + '_symbol');
  var algo_definition = this.getModel().get( algo_instance_id + '_definition');

  var open_orders_index = this.getModel().get('OpenOrdersIndex');
  var open_orders = {};
  if (goog.isDefAndNotNull(open_orders_index)) {
    goog.array.forEach(open_orders_index, function(order_id){
      open_orders[order_id] = this.getModel().get('order_' + order_id);
    }, this);
  }

  var algo_sandbox = [
    'var context = {\n',
    '  "algo_instance_id": "' + algo_instance_id + '",\n',
    '  "wss_url": "' + this.wss_url_ + '",\n',
    '  "symbol": "' + symbol.symbol +  '",\n',
    '  "open_orders": '+ goog.json.serialize(open_orders) +',\n',
    '  "algo_definition": ' + goog.json.serialize(algo_definition) + '\n',
    '};\n',
    '\n',
    '\n',
    algo,
    '\n',
    '\n',
    '// https://github.com/blinktrade/algorithm-trading/blob/master/algorithm_application.js \n',
    'var f;function h(a,b,c){return a.call.apply(a.bind,arguments)}function k(a,b,c){if(!a)throw Error();if(2<arguments.length){var d=Array.prototype.slice.call(arguments,2);return function(){var c=Array.prototype.slice.call(arguments);Array.prototype.unshift.apply(c,d);return a.apply(b,c)}}return function(){return a.apply(b,arguments)}}function goog$bind(a,b,c){goog$bind=Function.prototype.bind&&-1!=Function.prototype.bind.toString().indexOf("native code")?h:k;return goog$bind.apply(null,arguments)}\n',
    'function m(a,b){n.prototype[a]=b};var p=Array.prototype;function q(a,b,c,d){p.splice.apply(a,r(arguments,1))}function r(a,b,c){return 2>=arguments.length?p.slice.call(a,b):p.slice.call(a,b,c)};function t(a,b,c){for(var d in a)b.call(c,a[d],d,a)}var u="constructor hasOwnProperty isPrototypeOf propertyIsEnumerable toLocaleString toString valueOf".split(" ");function v(a,b){for(var c,d,e=1;e<arguments.length;e++){d=arguments[e];for(c in d)a[c]=d[c];for(var g=0;g<u.length;g++)c=u[g],Object.prototype.hasOwnProperty.call(d,c)&&(a[c]=d[c])}};function n(a,b,c,d,e,g){this.G=b;this.b=a;this.h=c;this.g=d;this.i=null;this.d=this.k=this.j=!1;this.l=[];this.c={};this.f={};this.e=new WebSocket(this.G);this.a=g(this,c);this.e.onopen=goog$bind(this.A,this);this.e.onmessage=goog$bind(this.w,this);this.e.onerror=goog$bind(this.v,this)}f=n.prototype;f.B=function(a,b,c){c=c||"algo_"+parseInt(1E7*Math.random(),10);postMessage({rep:"new_order_limited",instance:this.b,qty:a,side:"1",price:b,client_order_id:c});return c};\n',
    'f.n=function(a,b){null!=a||null!=b?null!=a&&null!=b?this.stop("Invalid paramaters. You must passa either opt_clientOrderId or opt_orderId"):postMessage({rep:"cancel_order",instance:this.b,client_order_id:a,order_id:b}):this.stop("Invalid paramaters. Missing opt_clientOrderId or opt_orderId")};f.m=function(){postMessage({rep:"cancel_order",instance:this.b})};\n',
    'f.C=function(a,b,c){c=c||"algo_"+parseInt(1E7*Math.random(),10);postMessage({rep:"new_order_limited",instance:this.b,qty:a,side:"2",price:b,client_order_id:c});return c};f.s=function(){return this.c[this.h]};f.o=function(a,b){return"deposit"==b?this.f[a]:"available"==b?this.f[a]-this.f[a+"_locked"]:this.f[a+"_"+b]};f.u=function(){return this.l};f.t=function(){return this.i};f.r=function(){return this.g};f.q=function(){return this.h};f.p=function(){return this.b};\n',
    'f.F=function(a,b,c){postMessage({rep:"notification",instance:this.b,type:c|NaN,title:a,description:b})};f.stop=function(a){try{this.d&&(this.a.stop(),this.d=!1)}catch(b){}null==a?postMessage({rep:"stop",instance:this.b}):postMessage({rep:"stop",instance:this.b,error:a})};\n',
    'f.A=function(){postMessage({rep:"create",instance:this.b,status:"ws_open"});var a=[this.h];this.e.send(JSON.stringify({MsgType:"V",MDReqID:parseInt(1E7*Math.random(),10),SubscriptionRequestType:"1",MarketDepth:0,MDUpdateType:"1",MDEntryTypes:["0","1","2"],Instruments:a}));this.e.send(JSON.stringify({MsgType:"e",SecurityStatusReqID:parseInt(1E7*Math.random(),10),SubscriptionRequestType:"1",Instruments:a}));setTimeout(goog$bind(this.D,this),3E4)};\n',
    'f.D=function(){this.e.send(JSON.stringify({MsgType:"1",TestReqID:parseInt(1E7*Math.random(),10),SendTime:(new Date).getTime()}))};function w(a){var b=x;if(!b.d){try{b.a.start(a),b.d=!0}catch(c){}postMessage({rep:"start",instance:b.b})}}function y(a,b){try{a.d&&(a.a.stop(),a.d=!1)}catch(c){}null==b?postMessage({rep:"terminate",instance:a.b}):postMessage({rep:"terminate",instance:a.b,error:b})}\n',
    'function z(a){var b=x;v(b.f,a);try{t(a,function(a,b){if("locked"==b.substring(4))this.a.onBalanceUpdate(b.substring(0,3),a,AlgorithmTradingInterface.BalanceType.LOCKED);else this.a.onBalanceUpdate(b,a,AlgorithmTradingInterface.BalanceType.DEPOSIT)},b)}catch(c){}postMessage({rep:"balance",instance:b.b})}function A(a){var b=x;b.i=a;try{b.a.onUpdateParams(a)}catch(c){}postMessage({rep:"params",instance:b.b})}\n',
    'function B(a){var b=x;"2"==a.OrdStatus||"4"==a.OrdStatus?delete b.g[a.OrderID]:b.g[a.OrderID]=a;try{b.a.onExecutionReport(a)}catch(c){}postMessage({rep:"execution_report",instance:b.b})}f.v=function(a){y(this,a.data)};\n',
    'function C(a,b){var c=b.Symbol,d=b.MDEntryType,e=b.MDEntryPositionNo-1,g=b.MDEntryPx,l=b.MDEntrySize;null==a.c[c]&&(a.c[c]={bids:[],asks:[]});"0"==d?q(a.c[c].bids,e,0,[g,l]):"1"==d&&q(a.c[c].asks,e,0,[g,l]);if(a.d){try{a.a.onOrderBookNewOrder(entry)}catch(s){}try{a.a.onOrderBookChange(a.c[c])}catch(I){}}}\n',
    'function D(a,b){var c=new Date,d=b.MDEntryDate.split("-"),e=b.MDEntryTime.split(":");c.setUTCFullYear(d[0]);c.setUTCMonth(d[1]);c.setUTCDate(d[2]);c.setUTCHours(e[0]);c.setUTCMinutes(e[1]);c.setUTCSeconds(e[2]);b.Timestamp=c;a.l.push(b);if(a.d)try{a.a.onTrade(b)}catch(g){}}\n',
    'f.w=function(a){a=JSON.parse(a.data);var b=a.MsgType;delete a.MsgType;switch(b){case "f":if(this.d)try{this.a.onTicker(a)}catch(c){}this.k||postMessage({rep:"create",instance:this.b,status:"received_security_status"});this.k=!0;break;case "W":for(var d in a.MDFullGrp){var e=a.MDFullGrp[d];e.MDReqID=a.MDReqID;switch(e.MDEntryType){case "0":case "1":e.Symbol=a.Symbol;C(this,e);break;case "2":D(this,e)}}this.j||postMessage({rep:"create",instance:this.b,status:"received_full_refresh"});this.j=!0;break;\n',
    '  case "X":for(e in a.MDIncGrp)switch(d=a.MDIncGrp[e],d.MDReqID=a.MDReqID,d.MDEntryType){case "0":case "1":switch(d.MDUpdateAction){case "0":C(this,d);break;case "1":var b=d.Symbol,g=d.MDEntryType,l=d.MDEntryPositionNo-1,s=d.MDEntrySize;"0"==g?this.c[b].bids[l]=[this.c[b].bids[l][0],s]:"1"==g&&(this.c[b].asks[l]=[this.c[b].asks[l][0],s]);if(this.d){try{this.a.onOrderBookUpdateOrder(d)}catch(I){}try{this.a.onOrderBookChange(this.c[b])}catch(J){}}break;case "2":b=d.Symbol;g=d.MDEntryPositionNo-1;l=d.MDEntryType;\n',
    '    "0"==l?this.c[b].bids.splice(g,1):"1"==l&&this.c[b].asks.splice(g,1);if(this.d){try{this.a.onOrderBookDeleteOrder(d)}catch(K){}try{this.a.onOrderBookChange(this.c[b])}catch(L){}}break;case "3":if(b=d.Symbol,g=d.MDEntryPositionNo,l=d.MDEntryType,"0"==l?this.c[b].bids.splice(0,g):"1"==l&&this.c[b].asks.splice(0,g),this.d){try{this.a.onOrderBookDeleteOrdersThru(d)}catch(M){}try{this.a.onOrderBookChange(this.c[b])}catch(N){}}}break;case "2":D(this,d)}}};var x;\n',
    'addEventListener("message",function(a){try{var b=a.data;switch(b.req){case "create":var c=eval(context.algo_definition.creator);x=new n(context.algo_instance_id,context.wss_url,context.symbol,context.open_orders,0,c);break;case "start":w(b.params);break;case "params":A(b.params);break;case "execution_report":B(b.execution_report);break;case "stop":x.stop();self.close();break;case "balance":z(b.balances)}}catch(d){null!=x&&y(x,d.message),self.close()}},!1);var E=n,F=["Application"],G=this;\n',
    'F[0]in G||!G.execScript||G.execScript("var "+F[0]);for(var H;F.length&&(H=F.shift());)F.length||void 0===E?G=G[H]?G[H]:G[H]={}:G[H]=E;m("sendBuyLimitedOrder",n.prototype.B);m("sendSellLimitedOrder",n.prototype.C);m("cancelAllOrders",n.prototype.m);m("cancelOrder",n.prototype.n);m("getOrderBook",n.prototype.s);m("getTrades",n.prototype.u);m("getBalance",n.prototype.o);m("getParameters",n.prototype.t);m("getOpenOrders",n.prototype.r);m("getMarket",n.prototype.q);m("getInstanceID",n.prototype.p);\n',
    'm("showNotification",n.prototype.F);m("stop",n.prototype.stop);\n'
  ];

  var blob = new Blob(algo_sandbox);
  var blobURL = window.URL.createObjectURL(blob);

  var running_algorithms = this.getModel().get('RunningAlgorithms');
  if (!goog.isDefAndNotNull(running_algorithms)) {
    running_algorithms = {};
  }

  var worker = new Worker(blobURL);
  running_algorithms[algo_instance_id] = {'blobURL': blobURL, 'worker': worker};
  this.getModel().set('RunningAlgorithms', running_algorithms);


  /**
   * @desc error algorithm notification message
   */
  var MSG_ERROR_RUNNING_ALGORITHM_NOTIFICATION = goog.getMsg('Error running algorithm');

  handler.listen(worker, 'message', function(e) {
    e = e.getBrowserEvent();
    switch(e.data['rep']) {
      case 'create':
        this.getModel().set( e.data['instance'] + '_status', '1' );
        if (e.data['status'] == 'received_security_status') {
          this.getModel().set( e.data['instance'] + '_status_received_security_status', '1' );
        }

        if (e.data['status'] == 'received_full_refresh') {
          this.getModel().set( e.data['instance'] + '_status_received_full_refresh', '1' );
        }
        if (e.data['status'] == 'ws_open') {
          this.getModel().set( e.data['instance'] + '_status_ws_open', '1' );
        }
        if (    this.getModel().get( e.data['instance'] + '_status_ws_open' )
             && this.getModel().get( e.data['instance'] + '_status_received_full_refresh' )
             && this.getModel().get( e.data['instance'] + '_status_received_security_status' )  ) {
          worker.postMessage({'req':'start', 'params': this.getModel().get( algo_instance_id + '_params') });
        }
        break;
      case 'start':
        this.getModel().set( e.data['instance'] + '_status', '2' );
        break;
      case 'notification':
        this.showNotification(e.data['type'], e.data['title'], e.data['description']);
        break;
      case 'error':
      case 'terminate':
      case 'stop':
        if (this.getModel().get( e.data['instance'] + '_status') == '2') {
          this.getModel().set( e.data['instance'] + '_status', '3' );
        }
        if (goog.isDefAndNotNull(e.data['error'])) {
          this.showNotification('error', MSG_ERROR_RUNNING_ALGORITHM_NOTIFICATION,  e.data['error']);
        }
        this.getModel().set( e.data['instance'] + '_status', '0' );
        running_algorithms = this.getModel().get('RunningAlgorithms');
        goog.object.remove(running_algorithms, e.data['instance']);
        this.getModel().set('RunningAlgorithms', running_algorithms);
        break;
      case 'new_order_limited':
        var order_symbol  = this.getModel().get( e.data['instance'] + '_symbol').symbol;
        this.getBitexConnection().sendLimitedOrder( order_symbol,
                                                    e.data['qty'],
                                                    e.data['price'],
                                                    e.data['side'],
                                                    this.getModel().get('SelectedBrokerID'),
                                                    undefined,
                                                    e.data['client_order_id']);


        break;
      case 'cancel_order':
        this.conn_.cancelOrder(e.data['client_order_id'], e.data['order_id']);
        break;
      default:
        break;
    }
  }, this);
  worker.postMessage({'req':'create', 'params': params });
};


/**
 * @param {bitex.model.ModelEvent} e
 * @private
 */
bitex.app.BlinkTrade.prototype.onAlgoStatusChange_ = function(e){
  var model = this.getModel();
  var algo_instance_id = e.key.substr(0, e.key.length - '_status'.length  );
  var new_status = e.data;
  if (new_status == '3'){ // '3' - pending stop

    /**
     * @desc starting algorithm notification message
     */
    var MSG_STOPPING_ALGORITHM_NOTIFICATION = goog.getMsg('stopping algorithm ....');
    this.showNotification('info', MSG_STOPPING_ALGORITHM_NOTIFICATION);


    var running_algorithms = this.getModel().get('RunningAlgorithms');
    var worker = running_algorithms[algo_instance_id]['worker'];
    worker.postMessage( { 'req': 'stop' } );
  }

};

/**
 * @param {bitex.model.ModelEvent} e
 * @private
 */
bitex.app.BlinkTrade.prototype.onAlgoParams_ = function(e){
  var algo_instance_id = e.key.substr(0, e.key.length - '_params'.length  );
  var parameters = e.data;

  var running_algorithms = this.getModel().get('RunningAlgorithms');
  var worker = running_algorithms[algo_instance_id]['worker'];

  worker.postMessage( { 'req': 'params', 'params': parameters } );
};


/**
 * @param {string} url
 */
bitex.app.blink_trade = function( url ) {
  var app = new bitex.app.BlinkTrade();
  app.run(url );
};


goog.exportSymbol('BlinkTradeApp', bitex.app.BlinkTrade);
goog.exportProperty(BlinkTradeApp.prototype, 'showNotification', bitex.app.BlinkTrade.prototype.showNotification);
goog.exportProperty(BlinkTradeApp.prototype, 'showDialog', bitex.app.BlinkTrade.prototype.showDialog);
goog.exportProperty(BlinkTradeApp.prototype, 'getHandler', bitex.app.BlinkTrade.prototype.getHandler);
goog.exportProperty(BlinkTradeApp.prototype, 'getCurrencyDescription', bitex.app.BlinkTrade.prototype.getCurrencyDescription);
goog.exportProperty(BlinkTradeApp.prototype, 'getCurrencySign', bitex.app.BlinkTrade.prototype.getCurrencySign);
goog.exportProperty(BlinkTradeApp.prototype, 'isCryptoCurrency', bitex.app.BlinkTrade.prototype.isCryptoCurrency);
goog.exportProperty(BlinkTradeApp.prototype, 'formatCurrency', bitex.app.BlinkTrade.prototype.formatCurrency);
goog.exportProperty(BlinkTradeApp.prototype, 'getBrokersByCountry', bitex.app.BlinkTrade.prototype.getBrokersByCountry);
goog.exportProperty(BlinkTradeApp.prototype, 'getAvailableBalanceForTrading', bitex.app.BlinkTrade.prototype.getAvailableBalanceForTrading);
goog.exportProperty(BlinkTradeApp.prototype, 'getModel', bitex.app.BlinkTrade.prototype.getModel);
goog.exportProperty(BlinkTradeApp.prototype, 'getQtyCurrencyFromSymbol', bitex.app.BlinkTrade.prototype.getQtyCurrencyFromSymbol);
goog.exportProperty(BlinkTradeApp.prototype, 'getPriceCurrencyFromSymbol', bitex.app.BlinkTrade.prototype.getPriceCurrencyFromSymbol);
goog.exportProperty(BlinkTradeApp.prototype, 'setView', bitex.app.BlinkTrade.prototype.setView);
goog.exportProperty(BlinkTradeApp.prototype, 'run', bitex.app.BlinkTrade.prototype.run);


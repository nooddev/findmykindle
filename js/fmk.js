$(function() {
  Parse.$ = jQuery;
  // Initialize Parse with your Parse application javascript keys
  Parse.initialize("CVKBJuIraBLT7fKeyFGWoPGWHeycTj6TSImraONF", "fxHHcIw6MiSfi9bjS26yeWasCNzs4GolrxIXMyLp");

  // This is the transient application state, not persisted on Parse
  var AppState = Parse.Object.extend("AppState", {
    defaults: {
      filter: "all"
    }
  });

  // The main view that lets a user manage their device items
  var ManageDevicesView = Parse.View.extend({
    // Our template for the line of statistics at the bottom of the app.
//    statsTemplate: _.template($('#stats-template').html()),

    // Delegated events for creating new items, and clearing completed ones.
    events: {
      "click .log-out": "logOut",
      "click .make-noise": "makeNoise",
      "click .open-map": "openMap"
    },

    el: ".content",

    // At initialization we bind to the relevant events on the `Devices`
    // collection, when items are added or changed. Kick things off by
    // loading any preexisting devices that might be saved to Parse.
    initialize: function() {
      // Main device management template
      this.$el.html(_.template($("#manage-devices-template").html()));

      // Setup the query for the collection to look for devices from the current user
      var user = Parse.User.current();
      if(user && user.id) {
          // wake all up
          var WakeUp = Parse.Object.extend("WakeUp");
          var wakeUp = new WakeUp();

          wakeUp.set("user", user);
          wakeUp.save(null, {
              success: function(wakeUp) {
                  // Execute any logic that should take place after the object is saved.
//                  alert('Successfully waken up: ' + wakeUp.id);
              },
              error: function(wakeUp, error) {
                  // Execute any logic that should take place if the save fails.
                  // error is a Parse.Error with an error code and description.
                  alert('Failed to wake up device, error: ' + error.description);
              }
          });

          var fbUrl = 'https://find-' + user.id + '.firebaseio-demo.com/User/' + user.id + '/';
          var myDataRef = new Firebase(fbUrl);
          myDataRef.on('value', function(snapshot) {
              $('#device-list').empty();  // clear old content first
              var msgRoot = snapshot.val();
              $.each(msgRoot, function(idx, deviceList) {
                  $.each(deviceList, function(key, device) {
                      displayDevice(device);
                  });
              });
          });
          function displayDevice(device) {
              var onlineStr = (device && device.live)?'online':'offline';
              var lat = (device && device.location && device.location.latitude)?device.location.latitude:0;
              var long = (device && device.location && device.location.longitude)?device.location.longitude:0;
              var radius = (device && device.location && device.location.radius)?device.location.radius:0;
              $('<li/>')
                  .append($('<a href="#" target="_self" user-id="' +user.id+ '" object-id="'+device.objectId+ '" class="make-noise"/>')
                  .html(device.name + '<span style="font-size:16px; text-decoration:none">&nbsp;(battery:' + Math.round(device.battery*100) +
                          '%; device: ' + onlineStr + ')</span>'))
                  .append($('<div class="button-group"/>')
                      .append('<button><a href="#" user-id="'
                      +user.id+ '" object-id="'+device.objectId+ '" class="make-noise">Ring</a></button>' +
                          '<button><a href="#" class="open-map" ' +
                      ' lat="'+lat+ '"' +
                      ' long="'+long+ '"' +
                      ' radius="'+radius + '"' +
                      '>Map</a></button>'))
                  .appendTo($('#device-list'));
          };
      }
    },

      makeNoise: function(e) {
          var el = $(e.target);
          var userId = el.attr("user-id");
          var objId = el.attr("object-id");
          var fbUrl = 'https://find-' + userId + '.firebaseio-demo.com/User/' + userId + '/Install/' + objId
              +'/speak';
          var myDataRef = new Firebase(fbUrl);
          myDataRef.set("Hi, I'm here.");
      },

      openMap: function(e) {
          var el = $(e.target);
          var lat = el.attr("lat");
          var long = el.attr("long");
          var radius = el.attr("radius");
          if(lat !== "0" && long !== "0") {
              window.location.href = "map.html?lat=" + lat + "&long="+long + "&radius="+radius;
          } else {
              alert('Location info is not available.');
          }
      },

    // Logs out the user and shows the login view
    logOut: function(e) {
      Parse.User.logOut();
      new LogInView();
      this.undelegateEvents();
      delete this;
    },

    // Re-rendering the App just means refreshing the statistics -- the rest
    // of the app doesn't change.
    render: function() {
      var done = this.devices.done().length;
      var remaining = this.devices.remaining().length;

      this.$('#device-stats').html(this.statsTemplate({
        total:      this.devices.length,
        done:       done,
        remaining:  remaining
      }));

      this.delegateEvents();

//      this.allCheckbox.checked = !remaining;
        }

  });

    // Login View
  var LogInView = Parse.View.extend({
    events: {
      "submit form.login-form": "logIn",
      "submit form.signup-form": "signUp"
    },

    el: ".content",
    
    initialize: function() {
      _.bindAll(this, "logIn", "signUp");
      this.render();
    },

    logIn: function(e) {
      var self = this;
      var username = this.$("#login-username").val();
      var password = this.$("#login-password").val();
      
      Parse.User.logIn(username, password, {
        success: function(user) {
          new ManageDevicesView();
          self.undelegateEvents();
          delete self;
        },

        error: function(user, error) {
          self.$(".login-form .error").html("Invalid username or password. Please try again.").show();
          self.$(".login-form button").removeAttr("disabled");
        }
      });

      this.$(".login-form button").attr("disabled", "disabled");

      return false;
    },

    signUp: function(e) {
      var self = this;
      var username = this.$("#signup-username").val();
      var password = this.$("#signup-password").val();
      
      Parse.User.signUp(username, password, { ACL: new Parse.ACL() }, {
        success: function(user) {
          new ManageDevicesView();
          self.undelegateEvents();
          delete self;
        },

        error: function(user, error) {
          self.$(".signup-form .error").html(error.message).show();
          this.$(".signup-form button").removeAttr("disabled");
        }
      });

      this.$(".signup-form button").attr("disabled", "disabled");

      return false;
    },

    render: function() {
      this.$el.html(_.template($("#login-template").html()));
      this.delegateEvents();
    }
  });

  // The main view for the app
  var AppView = Parse.View.extend({
    // Instead of generating a new element, bind to the existing skeleton of
    // the App already present in the HTML.
    el: $("#deviceapp"),

    initialize: function() {
      this.render();
    },

    render: function() {
      if (Parse.User.current()) {
        new ManageDevicesView();
      } else {
        new LogInView();
      }
    }
  });

  var AppRouter = Parse.Router.extend({
    routes: {
      "all": "all",
      "active": "active",
      "completed": "completed"
    },

    initialize: function(options) {
    },

    all: function() {
      state.set({ filter: "all" });
    },

    active: function() {
      state.set({ filter: "active" });
    },

    completed: function() {
      state.set({ filter: "completed" });
    }
  });

  var state = new AppState;

  new AppRouter;
  new AppView;
  Parse.history.start();
});

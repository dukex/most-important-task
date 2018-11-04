const St = imports.gi.St;
const Main = imports.ui.main;
const Lang = imports.lang;
const Soup = imports.gi.Soup;
const Mainloop = imports.mainloop;
const Goa = imports.gi.Goa;

const Account = new Lang.Class({
  Name: 'Account',
  _init: function() {

  },
  get_token: function () {
    const client = Goa.Client.new_sync(null);
    const access_token = client.get_accounts()
      .filter(a => a.get_account().provider_type === 'todoist')
      .map(function(account) {
        return account.get_oauth2_based().call_get_access_token_sync(null);
      })
      .map(function(result) {
        let [, access_token, ] = result;
        return access_token;
      });

    return access_token[0];
  }
});

let button, label, account, _timeout, _httpSession;

function request(method, path, params, fn) {
  let message = Soup.form_request_new_from_hash(method, `https://beta.todoist.com/API/v8/${path}`, params);
  message.request_headers.append("Authorization", `Bearer ${account.get_token()}`);

  _httpSession.queue_message(message, Lang.bind(this,
    function (_httpSession, message) {
      if (message.status_code !== 200)
        return;
      let json = JSON.parse(message.response_body.data);

      fn(json);
    }
  ));
}

function refresh() {
  if (_timeout) {
    Mainloop.source_remove(_timeout);
    _timeout = null;
  }

  request("GET", "tasks", { filter: "@mit & (today | overdue)" }, function(tasks) {
    task = tasks.sort((a,b) => new Date(a.due.date) - new Date(b.due.date))[0];
    if(task) {
      label.set_text(task.content);
    } else {
      label.set_text("Definir M.I.T.");
    }
  });

  _timeout = Mainloop.timeout_add_seconds(60, Lang.bind(this, refresh));
}


function init() {
  account = new Account();

  _httpSession = new Soup.Session();

  button = new St.Bin({ style_class: 'panel-button',
    reactive: true,
    can_focus: true,
    x_fill: true,
    y_fill: false,
    track_hover: true
  });

  label = new St.Label({ text: "Loading..." });
  button.set_child(label);
  button.connect('button-press-event', function() {
    if(task) {
      let file = imports.gi.Gio.File.new_for_uri(task.url);
      file.query_exists(null);
      file.query_default_handler(null).launch([file], null);
    }
  });
}

function enable() {
  Main.panel._centerBox.insert_child_at_index(button, 0);
  refresh();
}

function disable() {
  Main.panel._centerBox.remove_child(button);
  if (_timeout) {
    Mainloop.source_remove(_timeout);
    _timeout = null;
  }
}

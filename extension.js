const St = imports.gi.St;
const Main = imports.ui.main;
const Soup = imports.gi.Soup;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

const Me = imports.misc.extensionUtils.getCurrentExtension();

let settings,
  button,
  label,
  account,
  _timeout,
  _httpSession,
  gschema,
  cancellable,
  currentTask;

class Account {
  getToken() {
    return settings.get_string("todoist-api-token");
  }

  getSearch() {
    return settings.get_string("todoist-search");
  }

  getRules() {
    return settings.get_strv('todoist-search-rules')
  }
}

const logTodoist = (message) => log("[mit@emersonalmeidax.wtf]["+ new Date() +"] " + message);

const request = (method, path, params) => {
  return new Promise((resolve, reject) => {
    try {

    logTodoist("todoist: request(" + method + ", " + path + ", " + params);

    const query = Soup.form_encode_hash(params); //Object.keys(params).map((key) => `${key}=${params[key]}`).join("&")

    logTodoist(
      "curl -X" +
        method +
        " -H 'Authorization: " +
        `Bearer ${account.getToken()}' ` +
        ` 'https://api.todoist.com/rest/v2/${path}?${query}'`
    );

    const message = Soup.Message.new_from_encoded_form(
      method,
      `https://api.todoist.com/rest/v2/${path}`,
      query
    );

    logTodoist("message" + message);

    message.request_headers.append(
      "Authorization",
      `Bearer ${account.getToken()}`
    );

    const bytes = _httpSession.send_and_read(message, cancellable);

    decoder = new TextDecoder()

    logTodoist("bytesL: " + bytes)
    json = JSON.parse(decoder.decode(bytes.get_data()));
    logTodoist("json"  + json);
    resolve(json)

  } catch (error) {
    logTodoist("error" + error)
    reject(error)
  }
  });
};

const fetchTask = (query) => {
  logTodoist("todoist: fetchTask()");



  return new Promise((resolve, reject) => {
    request("GET", "tasks", { filter: query }).then((tasks) => {
      const task = tasks.sort(
        (a, b) => new Date(a.due.date) - new Date(b.due.date)
      )[0];
      if (task) resolve(task);
      else reject(task);
    }, reject);
  });
};

var setTask = (task) => {
  if (task) {
    if (task.url) {
      currentTask = task;
      logTodoist(JSON.stringify(currentTask));
    }

    label.set_text(task.content);
    return task;
  } else {
    throw task;
  }
};

var logTodoistRejectionError = (fn) => (error) => {
  logTodoist(`rejected: ${JSON.stringify(error)}`);
  fn(error);
};

function assignTask() {


  logTodoist(typeof account.getRules());

  fetchTask(account.getSearch())
    .then(
      setTask,
      logTodoistRejectionError(() => {
        return fetchTask("7 days");
      })
    )
    .then(
      setTask,
      logTodoistRejectionError(() => {
        return fetchTask("assigned to: me");
      })
    )
    .then(
      setTask,
      logTodoistRejectionError(() => {
        setTask({ content: "=)" });
      })
    );
}

function refresh() {
  logTodoist("refresh");

  if (_timeout) {
    GLib.source_remove(_timeout);
    _timeout = null;
  }

  assignTask();

  // TODO: move the seconds to settings
  _timeout = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 60, refresh);
}

function init() {
  logTodoist("todoist: init()");
}

function enable() {
  logTodoist("todoist: enable()");

  gschema = Gio.SettingsSchemaSource.new_from_directory(
    Me.dir.get_child("schemas").get_path(),
    Gio.SettingsSchemaSource.get_default(),
    false
  );

  settings = new Gio.Settings({
    settings_schema: gschema.lookup("org.gnome.shell.extensions.mit", true),
  });

  account = new Account();
  cancellable = new Gio.Cancellable()
  _httpSession = new Soup.Session();

  button = new St.Button({
    style_class: "panel-button",
    reactive: true,
    can_focus: true,
    // x_fill: true,
    // y_fill: false,
    track_hover: true,
  });

  label = new St.Label({ text: "Loading..." });
  button.set_child(label);

  button.connect("button-press-event", () => {
    if (currentTask) {
      logTodoist(JSON.stringify(currentTask));
      let file = imports.gi.Gio.File.new_for_uri(currentTask.url);
      file.query_exists(null);
      file.query_default_handler(null).launch([file], null);
    }
  });

  Main.panel._centerBox.insert_child_at_index(button, 0);
  logTodoist("enable");
  refresh();
}

function disable() {
  _httpSession.abort();
  // Main.panel._centerBox.remove_child(button);
  if (_timeout) {
    GLib.source_remove(_timeout);
    _timeout = null;
  }

  cancellable.cancel();

  cancellable = null
  _httpSession = null;
  account = null;
  button = null;
  currentTask = null;
  gschema = null;
  label = null;
  settings = null;
}

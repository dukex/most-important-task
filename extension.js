const St = imports.gi.St;
const Main = imports.ui.main;
const Soup = imports.gi.Soup;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const PanelMenu = imports.ui.panelMenu;

let settings,
  button,
  label,
  account,
  _timeout,
  _httpSession,
  gschema,
  cancellable,
  currentTask,
  reloadButton;

/// TODOIS - Task Provider

class Account {
  getToken() {
    return settings.get_string("todoist-api-token");
  }

  getRules() {
    return settings.get_strv("todoist-search-rules");
  }
}

// GUI

class TaskViewUI {}
class RefreshButtonUI {
  constructor({ refresh }) {
    this._icon = null;
    this._button = null;
    this.refresh = refresh;
  }

  disable() {}

  render() {
    this._icon = new St.Icon({
      gicon: new Gio.ThemedIcon({ name: "view-refresh-symbolic" }),
      style_class: "system-status-icon",
    });

    this._button = new St.Button({
      style_class: "panel-button",
      reactive: true,
      can_focus: true,
      track_hover: true,
    });

    this._button.set_child(this._icon);

    this._button.connect("button-press-event", () => {
      this.refresh();
    });

    return this._button;
  }
}

// UTILS

class Logger {
  info(message) {
    log("[mit@emersonalmeidax.wtf][" + new Date() + "] " + message);
  }
}

const logger = new Logger();

// EXTENSION

class Extension {
  constructor(logger) {
    this.logger = logger;
  }

  enable() {
    this.logger.info(`enabling ${Me.metadata.name}`);

    this._refreshButton = new RefreshButtonUI({
      refresh: () => {
        this.logger.info("refreshing");
      },
    }).render();

    this._taskView = new TaskViewUI();

    Main.panel._centerBox.insert_child_at_index(
      this._refreshButton.render(),
      0
    );
  }

  // REMINDER: It's required for extensions to clean up after themselves when
  // they are disabled. This is required for approval during review!
  disable() {
    this.logger.info(`disabling ${Me.metadata.name}`);

    Main.panel._centerBox.remove_child(this._refreshButton);
    this._refreshButton = null;

    Main.panel._centerBox.remove_child(this._taskView);
    this._taskView = null;
  }
}

// const logger.info = (message) =>
//

// const request = (method, path, params) => {
//   return new Promise((resolve, reject) => {
//     try {
//       logger.info("todoist: request(" + method + ", " + path + ", " + params);

//       const query = Soup.form_encode_hash(params); //Object.keys(params).map((key) => `${key}=${params[key]}`).join("&")

//       logger.info(
//         "curl -X" +
//           method +
//           " -H 'Authorization: " +
//           `Bearer ${account.getToken()}' ` +
//           ` 'https://api.todoist.com/rest/v2/${path}?${query}'`
//       );

//       const message = Soup.Message.new_from_encoded_form(
//         method,
//         `https://api.todoist.com/rest/v2/${path}`,
//         query
//       );

//       logger.info("message" + message);

//       message.request_headers.append(
//         "Authorization",
//         `Bearer ${account.getToken()}`
//       );

//       _httpSession.send_and_read_async(
//         message,
//         1000,
//         cancellable,
//         (source, result) => {
//           logger.info("hello");

//           const bytes = _httpSession.send_and_read_finish(result);
//           decoder = new TextDecoder();

//           logger.info("bytesL: " + bytes);
//           body = decoder.decode(bytes.get_data());
//           logger.info(body);
//           json = JSON.parse(body);
//           logger.info("json" + json);
//           resolve(json);
//         }
//       );
//     } catch (error) {
//       logger.info("error" + error);
//       reject(error);
//     }
//   });
// };

// const fetchTask = (query) => {
//   logger.info("todoist: fetchTask()");

//   return new Promise((resolve, reject) => {
//     request("GET", "tasks", { filter: query }).then((tasks) => {
//       const task = tasks.sort(
//         (a, b) => new Date(a.due.date) - new Date(b.due.date)
//       )[0];
//       if (task) resolve(task);
//       else reject(task);
//     }, reject);
//   });
// };

// var setTask = (rule) => (task) => {
//   if (task) {
//     if (task.url) {
//       currentTask = task;
//       logger.info(JSON.stringify(currentTask));
//     }

//     label.set_text(rule + ": " + task.content);
//     return task;
//   } else {
//     throw task;
//   }
// };

// var logger.infoRejectionError = (fn) => (error) => {
//   logger.info(`rejected: ${JSON.stringify(error)}`);
//   fn(error);
// };

// const tryToGetTask = (rules) => {
//   return new Promise((resolve, reject) => {
//     const rule = rules.shift();

//     if (rule) {
//       logger.info("rule: " + rule);

//       const query = rule.replace(
//         "overdue",
//         "due before:" + GLib.DateTime.new_now_local().format("%m/%d/%Y %H:%M")
//       );

//       fetchTask(query)
//         .then(
//           setTask(rule),
//           logger.infoRejectionError(() => {
//             return tryToGetTask(rules);
//           })
//         )
//         .then(resolve, reject);
//     } else {
//       logger.info("no rules");
//       reject("no rules");
//     }
//   });
// };

// function assignTask() {
//   const rules = account.getRules();

//   tryToGetTask(rules).catch((e) => {
//     logger.info(e);
//     setTask({ content: "=)" });
//   });
// }

// function refresh() {
//   logger.info("refresh");

//   if (_timeout) {
//     GLib.source_remove(_timeout);
//     _timeout = null;
//   }

//   assignTask();

//   // TODO: move the seconds to settings
//   _timeout = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 60, refresh);
// }

function init() {
  logger.info("init()");

  return new Extension(logger);
}

// function enable() {
//   logger.info("todoist: enable()");

//   gschema = Gio.SettingsSchemaSource.new_from_directory(
//     Me.dir.get_child("schemas").get_path(),
//     Gio.SettingsSchemaSource.get_default(),
//     false
//   );

//   settings = new Gio.Settings({
//     settings_schema: gschema.lookup("org.gnome.shell.extensions.mit", true),
//   });

//   account = new Account();
//   cancellable = new Gio.Cancellable();
//   _httpSession = new Soup.Session();

//   button = new St.Button({
//     style_class: "panel-button",
//     reactive: true,
//     can_focus: true,
//     track_hover: true,
//   });

//   label = new St.Label({ text: "Loading..." });
//   button.set_child(label);

//   button.connect("button-press-event", () => {
//     if (currentTask) {
//       logger.info(JSON.stringify(currentTask));
//       let file = imports.gi.Gio.File.new_for_uri(currentTask.url);
//       file.query_exists(null);
//       file.query_default_handler(null).launch([file], null);
//     }
//   });

//   Main.panel._centerBox.insert_child_at_index(button, 0);

//   refresh();
// }

// function disable() {
//   _httpSession.abort();
//   Main.panel._centerBox.remove_child(button);
//   Main.panel._centerBox.remove_child(reloadButton);
//   if (_timeout) {
//     GLib.source_remove(_timeout);
//     _timeout = null;
//   }

//   cancellable.cancel();

//   cancellable = null;
//   _httpSession = null;
//   account = null;
//   button = null;
//   reloadButton = null;
//   currentTask = null;
//   gschema = null;
//   label = null;
//   settings = null;
// }

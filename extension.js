const St = imports.gi.St;
const Main = imports.ui.main;
const Soup = imports.gi.Soup;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

const Me = imports.misc.extensionUtils.getCurrentExtension();

let settings, button, label, account, _timeout, _httpSession, gschema, currentTask;

class Account {
    getToken() {
        return settings.get_string('todoist-api-token');
    }
}

const request = (method, path, params) => {
    const message = Soup.form_request_new_from_hash(method, `https://api.todoist.com/rest/v1/${path}`, params);
    message.request_headers.append('Authorization', `Bearer ${account.getToken()}`);

    return new Promise((resolve, reject) => {
        _httpSession.queue_message(message, (_session, response) => {
            if (response.status_code !== 200)
                return reject(response);


            let json = JSON.parse(response.response_body.data);

            return resolve(json);
        });
    });
};

const fetchTask = query => {
    return new Promise((resolve, reject) => {
        request('GET', 'tasks', { filter: query })
      .then(tasks => {
          const task = tasks.sort((a, b) => new Date(a.due.date) - new Date(b.due.date))[0];
          if (task)
              resolve(task);
          else
              reject(task);

      }, reject);
    });
};


var setTask = task => {
    if (task) {
        if (task.url) {
            currentTask = task;
            log(JSON.stringify(currentTask));
        }


        label.set_text(task.content);
        return true;
    } else {
        throw task;
    }
};

function assignTask() {
    fetchTask('@mit & (today | overdue)')
    .then(setTask, () => {
        return fetchTask('7 days');
    })
    .then(setTask, () => {
        return fetchTask('assigned to: me');
    })
    .then(setTask, () => {
        setTask({ content: '=)' });
    });
}

function refresh() {
    log('refresh');

    if (_timeout) {
        GLib.source_remove(_timeout);
        _timeout = null;
    }

    assignTask();

    // TODO: move the seconds to settings
    _timeout = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 60, refresh);
}

function init() {
}

function enable() {
    gschema = Gio.SettingsSchemaSource.new_from_directory(
        Me.dir.get_child('schemas').get_path(),
        Gio.SettingsSchemaSource.get_default(),
        false,
    );

    settings = new Gio.Settings({
        settings_schema: gschema.lookup('org.gnome.shell.extensions.mit', true),
    });

    account = new Account();

    _httpSession = new Soup.Session();

    button = new St.Bin({ style_class: 'panel-button',
        reactive: true,
        can_focus: true,
        x_fill: true,
        y_fill: false,
        track_hover: true });

    label = new St.Label({ text: 'Loading...' });
    button.set_child(label);

    button.connect('button-press-event', () => {
        if (currentTask) {
            log(JSON.stringify(currentTask));
            let file = imports.gi.Gio.File.new_for_uri(currentTask.url);
            file.query_exists(null);
            file.query_default_handler(null).launch([file], null);
        }
    });

    Main.panel._centerBox.insert_child_at_index(button, 0);
    log('enable');
    refresh();
}

function disable() {
    _httpSession.abort();
    Main.panel._centerBox.remove_child(button);
    if (_timeout) {
        GLib.source_remove(_timeout);
        _timeout = null;
    }

    _httpSession = null;
    account = null;
    button = null;
    currentTask = null;
    gschema = null;
    label = null;
    settings = null;
}

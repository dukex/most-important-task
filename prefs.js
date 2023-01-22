"use strict";

const { Adw, Gio, GLib, GObject, Gtk, Pango } = imports.gi;
const Me = imports.misc.extensionUtils.getCurrentExtension();

let settings;

const logTodoist = (message) =>
  log("[mit@emersonalmeidax.wtf][" + new Date() + "] " + message);

class NewItem extends GObject.Object {}
GObject.registerClass(NewItem);

class NewItemModel extends GObject.Object {
  static [GObject.interfaces] = [Gio.ListModel];
  static {
    GObject.registerClass(this);
  }

  #item = new NewItem();

  vfunc_get_item_type() {
    return NewItem;
  }

  vfunc_get_n_items() {
    return 1;
  }

  vfunc_get_item(_pos) {
    return this.#item;
  }
}

let gschema = Gio.SettingsSchemaSource.new_from_directory(
  Me.dir.get_child("schemas").get_path(),
  Gio.SettingsSchemaSource.get_default(),
  false
);

class RulesList extends GObject.Object {
  static [GObject.interfaces] = [Gio.ListModel];
  static {
    GObject.registerClass(this);
  }

  #settings = new Gio.Settings({
    settings_schema: gschema.lookup("org.gnome.shell.extensions.mit", true),
  });
  #names = this.#settings.get_strv("todoist-search-rules");
  #items = Gtk.StringList.new(this.#names);
  #changedId;

  constructor() {
    super();

    this.#changedId = this.#settings.connect(
      `changed::${"todoist-search-rules"}`,
      () => {
        logTodoist("connect changed");
        const removed = this.#names.length;
        this.#names = this.#settings.get_strv("todoist-search-rules");
        this.#items.splice(0, removed, this.#names);
        this.items_changed(0, removed, this.#names.length);
      }
    );
  }

  append() {
    logTodoist("append");

    const name = "Rule %d".format(this.#names.length + 1);

    this.#names.push(name);
    this.#settings.block_signal_handler(this.#changedId);
    this.#settings.set_strv("todoist-search-rules", this.#names);
    this.#settings.unblock_signal_handler(this.#changedId);

    const pos = this.#items.get_n_items();
    this.#items.append(name);
    this.items_changed(pos, 0, 1);
  }

  remove(name) {
    logTodoist("remove");

    const pos = this.#names.indexOf(name);
    if (pos < 0) return;

    this.#names.splice(pos, 1);

    this.#settings.block_signal_handler(this.#changedId);
    this.#settings.set_strv("todoist-search-rules", this.#names);
    this.#settings.unblock_signal_handler(this.#changedId);

    this.#items.remove(pos);
    this.items_changed(pos, 1, 0);
  }

  rename(oldName, newName) {
    const pos = this.#names.indexOf(oldName);

    logTodoist("rename");
    logTodoist(oldName);
    logTodoist(newName);

    if (pos < 0) return;

    this.#names.splice(pos, 1, newName);
    this.#items.splice(pos, 1, [newName]);

    this.#settings.block_signal_handler(this.#changedId);
    this.#settings.set_strv("todoist-search-rules", this.#names);
    this.#settings.unblock_signal_handler(this.#changedId);
  }

  vfunc_get_item_type() {
    return Gtk.StringObject;
  }

  vfunc_get_n_items() {
    return this.#items.get_n_items();
  }

  vfunc_get_item(pos) {
    return this.#items.get_item(pos);
  }
}

class NewRuleRow extends Adw.PreferencesRow {
  static {
    GObject.registerClass(this);
  }

  constructor() {
    super({
      action_name: "rules.add",
      child: new Gtk.Image({
        icon_name: "list-add-symbolic",
        pixel_size: 16,
        margin_top: 12,
        margin_bottom: 12,
        margin_start: 12,
        margin_end: 12,
      }),
    });
    this.update_property([Gtk.AccessibleProperty.LABEL], ["Add Rule"]);
  }
}

class RuleRow extends Adw.PreferencesRow {
  static {
    GObject.registerClass(this);
  }

  constructor(name) {
    super({ name });

    const box = new Gtk.Box({
      spacing: 12,
      margin_top: 6,
      margin_bottom: 6,
      margin_start: 6,
      margin_end: 6,
    });

    const label = new Gtk.Label({
      hexpand: true,
      xalign: 0,
      max_width_chars: 25,
      ellipsize: Pango.EllipsizeMode.END,
    });
    this.bind_property(
      "name",
      label,
      "label",
      GObject.BindingFlags.SYNC_CREATE
    );
    box.append(label);

    const button = new Gtk.Button({
      action_name: "rules.remove",
      icon_name: "edit-delete-symbolic",
      has_frame: false,
    });
    box.append(button);

    this.bind_property_full(
      "name",
      button,
      "action-target",
      GObject.BindingFlags.SYNC_CREATE,
      (bind, target) => [true, new GLib.Variant("s", target)],
      null
    );

    this._entry = new Gtk.Entry({
      max_width_chars: 25,
    });

    const controller = new Gtk.ShortcutController();
    controller.add_shortcut(
      new Gtk.Shortcut({
        trigger: Gtk.ShortcutTrigger.parse_string("Escape"),
        action: Gtk.CallbackAction.new(() => {
          this._stopEdit();
          return true;
        }),
      })
    );
    this._entry.add_controller(controller);

    this._stack = new Gtk.Stack();
    this._stack.add_named(box, "display");
    this._stack.add_named(this._entry, "edit");
    this.child = this._stack;

    this._entry.connect("activate", () => {
      logTodoist("connect activate");

      this.activate_action(
        "rules.rename",
        new GLib.Variant("(ss)", [this.name, this._entry.text])
      );
      this.name = this._entry.text;
      this._stopEdit();
    });
    this._entry.connect("notify::has-focus", () => {
      if (this._entry.has_focus) return;
      this._stopEdit();
    });
  }

  edit() {
    this._entry.text = this.name;
    this._entry.grab_focus();
    this._stack.visible_child_name = "edit";
  }

  _stopEdit() {
    this.grab_focus();
    this._stack.visible_child_name = "display";
  }
}

class RulesSettingsWidget extends Adw.PreferencesGroup {
  static {
    GObject.registerClass(this);

    this.install_action("rules.add", null, (self) => self._rules.append());
    this.install_action("rules.remove", "s", (self, name, param) =>
      self._rules.remove(param.unpack())
    );
    this.install_action("rules.rename", "(ss)", (self, name, param) =>
      self._rules.rename(...param.deepUnpack())
    );
  }

  constructor() {
    super({
      title: "Rules",
    });

    this._rules = new RulesList();

    const store = new Gio.ListStore({ item_type: Gio.ListModel });
    const listModel = new Gtk.FlattenListModel({ model: store });
    store.append(this._rules);
    store.append(new NewItemModel());

    this._list = new Gtk.ListBox({
      selection_mode: Gtk.SelectionMode.NONE,
      css_classes: ["boxed-list"],
    });
    this._list.connect("row-activated", (l, row) => row.edit());
    this.add(this._list);

    this._list.bind_model(listModel, (item) => {
      return item instanceof NewItem
        ? new NewRuleRow()
        : new RuleRow(item.string);
    });
  }
}

function init() {}

function fillPreferencesWindow(window) {
  let gschema = Gio.SettingsSchemaSource.new_from_directory(
    Me.dir.get_child("schemas").get_path(),
    Gio.SettingsSchemaSource.get_default(),
    false
  );

  settings = new Gio.Settings({
    settings_schema: gschema.lookup("org.gnome.shell.extensions.mit", true),
  });

  const page = new Adw.PreferencesPage();
  const group = new Adw.PreferencesGroup();
  page.add(group);


  const todoistTokenLabel = new Gtk.Label({
    label: "Todoist API Token:",
    halign: Gtk.Align.START,
    visible: true,
  });
  group.add(todoistTokenLabel);

  const todoistTokenEntry = new Gtk.Entry({
    visible: true,
    text: settings.get_string("todoist-api-token"),
  });

  group.add(todoistTokenEntry);
  settings.bind(
    "todoist-api-token",
    todoistTokenEntry,
    "text",
    Gio.SettingsBindFlags.DEFAULT
  );

  page.add(new RulesSettingsWidget());

  window.add(page);
}

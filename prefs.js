'use strict';

const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Me = imports.misc.extensionUtils.getCurrentExtension();

let settings;

function init() {
  let gschema = Gio.SettingsSchemaSource.new_from_directory(
    Me.dir.get_child('schemas').get_path(),
    Gio.SettingsSchemaSource.get_default(),
    false
  );

  settings = new Gio.Settings({
    settings_schema: gschema.lookup('org.gnome.shell.extensions.mit', true)
  });
}

function buildPrefsWidget() {
  const prefsWidget = new Gtk.Grid({
    margin: 18,
    column_spacing: 12,
    row_spacing: 12,
    visible: true
  });

  const title = new Gtk.Label({
    label: '<b>' + Me.metadata.name + ' Preferences</b>',
    halign: Gtk.Align.START,
    use_markup: true,
    visible: true
  });
  prefsWidget.attach(title, 0, 0, 2, 1);

  const todoistTokenLabel = new Gtk.Label({
    label: 'Todoist API Token:',
    halign: Gtk.Align.START,
    visible: true
  });
  prefsWidget.attach(todoistTokenLabel, 0, 1, 1, 1);

  const todoistTokenEntry = new Gtk.Entry({
    visible: true,
    text: settings.get_string('todoist-api-token')
  });
  prefsWidget.attach(todoistTokenEntry, 1, 1, 1, 1);

  settings.bind('todoist-api-token', todoistTokenEntry, 'text', Gio.SettingsBindFlags.DEFAULT);

  return prefsWidget;
}

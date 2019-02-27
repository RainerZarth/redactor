(function($R){
  $R.add('plugin', 'addlink', {
      modals: {
          'addlink':
              '<form action=""> \
                  <div class="form-item"> \
                      <label for="modal-addlink-url">URL <span class="req">*</span></label> \
                      <input type="text" id="modal-addlink-url" name="url"> \
                  </div> \
                  <div class="form-item"> \
                      <label for="modal-addlink-text">## text ##</label> \
                      <input type="text" id="modal-addlink-text" name="text"> \
                  </div> \
                  <div class="form-item form-item-title"> \
                      <label for="modal-addlink-title">## title ##</label> \
                      <input type="text" id="modal-addlink-title" name="title"> \
                  </div> \
                  <div class="form-item form-item-target"> \
                      <label class="checkbox"> \
                          <input type="checkbox" name="target"> ## link-in-new-tab ## \
                      </label> \
                  </div> \
              </form>'
      },
      init: function(app)
      {
          this.app = app;
          // Zugriff auf Toolbar benötigt
          this.toolbar = app.toolbar;
          this.opts = app.opts;
          this.lang = app.lang;
          this.caret = app.caret;
          this.utils = app.utils;
          this.inline = app.inline;
          this.editor = app.editor;
          this.inspector = app.inspector;
          this.insertion = app.insertion;
          this.selection = app.selection;

          // local
          this.isCurrentLink = false;
          this.currentText = false;
      },
      translations: {
        en: {
          "addlink": "Literaturverzeichnis"
        }
      },
      //der Button muss dazugefügt werden beim start vom editor
      start: function () {
        var btnObj = {
          title: 'Literaturverzeichnis',
          icon: "\f02d",
          dropdown: {
            unlink: {
              title: 'ausgewählte Verknüpfung entfernen',
              api: 'plugin.addlink.unlink'
            }
          }
        };
        this.button = this.toolbar.addButton('addlink', btnObj);

        var dropdown = this.button.getDropdown(),
          items = dropdown.items,
          newList = {},
          counter = 0;
      },

      // messages
      onmodal: {
          addlink: {
              open: function($modal, $form)
              {
                  this._setFormData($form, $modal);
              },
              opened: function($modal, $form)
              {
                  this._setFormFocus($form);
              },
              update: function($modal, $form)
              {
                  var data = $form.getData();
                  if (this._validateData($form, data))
                  {
                      this._update(data);
                  }
              },
              insert: function($modal, $form)
              {
                  var data = $form.getData();
                  if (this._validateData($form, data))
                  {
                      this._insert(data);
                  }
              },
              unlink: function()
              {
                  this._unlink();
              }
          }
      },
      onbutton: {
          addlink: {
              observe: function(button)
              {
                  this._observeButton(button);
              }
          }
      },
      ondropdown: {
          addlink: {
              observe: function(dropdown)
              {
                  this._observeUnlink(dropdown);
                  this._observeEdit(dropdown);
              }
          }
      },
      oncontextbar: function(e, contextbar)
      {
          var current = this._getCurrent();
          var data = this.inspector.parse(current);
          if (data.isLink())
          {
              var node = data.getLink();
              var $el = $R.dom(node);

              var $point = $R.dom('<a>');
              var url = $el.attr('href');

              $point.text(this._truncateText(url));
              $point.attr('href', url);
              $point.attr('target', '_blank');

              var buttons = {
                  "addlink": {
                      title: $point
                  },
                  "edit": {
                      title: this.lang.get('edit'),
                      api: 'plugin.addlink.open'
                  },
                  "unlink": {
                      title: this.lang.get('unlink'),
                      api: 'plugin.addlink.unlink'
                  }
              };

              contextbar.set(e, node, buttons, 'bottom');
          }
      },

      // public
      open: function()
      {
          this.$link = this._buildCurrent();
          this.app.api('module.modal.build', this._getModalData());
      },
      insert: function(data)
      {
          this._insert(data);
      },
      update: function(data)
      {
          this._update(data);
      },
      unlink: function()
      {
          this._unlink();
      },

      // private
      _observeButton: function(button)
      {
          var current = this.selection.getCurrent();
          var data = this.inspector.parse(current);

          if (data.isPre() || data.isCode())
          {
              button.disable();
          }
          else
          {
              button.enable();
          }
      },
      _observeUnlink: function(dropdown)
      {
          var $item = dropdown.getItem('unlink');
          var links = this._getLinks();

          if (links.length === 0) $item.disable();
          else                    $item.enable();
      },
      _observeEdit: function(dropdown)
      {
          var current = this._getCurrent();
          var $item = dropdown.getItem('addlink');

          var data = this.inspector.parse(current);
          var title = (data.isLink()) ? this.lang.get('link-edit') : this.lang.get('link-insert');

          $item.setTitle(title);
      },
      _unlink: function()
      {
          this.app.api('module.modal.close');

          var elms = [];
          var nodes = this._getLinks();

          this.selection.save();
          for (var i = 0; i < nodes.length; i++)
          {
              var $link = $R.create('addlink.component', this.app, nodes[i]);
              elms.push(this.selection.getElement(nodes[i]));

              $link.unwrap();

              // callback
              this.app.broadcast('addlink.deleted', $link);
          }
          this.selection.restore();

          // normalize
          for (var i = 0; i < elms.length; i++)
          {
              var el = (elms[i]) ? elms[i] : this.editor.getElement();
              this.utils.normalizeTextNodes(el);
          }

          this._resetCurrent();
      },
      _update: function(data)
      {
          this.app.api('module.modal.close');

          var nodes = this._getLinks();
          this._setLinkData(nodes, data, 'updated');
          this._resetCurrent();
      },
      _insert: function(data)
      {
          this.app.api('module.modal.close');

          var links = this._getLinks();

          if (!this._insertSingle(links, data))
          {
              this._removeInSelection(links);
              this._insertMultiple(data);
          }

          this._resetCurrent();
      },
      _removeInSelection: function(links)
      {
          this.selection.save();
          for (var i = 0; i < links.length; i++)
          {
              var $link = $R.create('addlink.component', this.app, links[i]);
              var $clonedLink = $link.clone();
              $link.unwrap();

              // callback
              this.app.broadcast('addlink.deleted', $clonedLink);
          }
          this.selection.restore();
      },
      _insertMultiple: function(data)
      {
          var range = this.selection.getRange();
          if (range && this._isCurrentTextChanged(data))
          {
              this._deleteContents(range);
          }

          var nodes = this.inline.format({ tag: 'a' });

          this._setLinkData(nodes, data, 'inserted');
      },
      _insertSingle: function(links, data)
      {
          var inline = this.selection.getInline();
          if (links.length === 1 && (links[0].textContext === this.selection.getText()) || (inline && inline.tagName === 'A'))
          {
              var $link = $R.create('addlink.component', this.app, links[0]);

              $link.setData(data);
              this.caret.setAfter($link);

              // callback
              this.app.broadcast('addlink.inserted', $link);

              return true;
          }

          return false;
      },
      _setLinkData: function(nodes, data, type)
      {
          data.text = (data.text.trim() === '') ? this._truncateText(data.url) : data.text;

          var isTextChanged = (!this.currentText || this.currentText !== data.text);

          this.selection.save();
          for (var i = 0; i < nodes.length; i++)
          {
              var $link = $R.create('addlink.component', this.app, nodes[i]);
              var linkData = {};

              if (data.text && isTextChanged) linkData.text = data.text;
              if (data.url) linkData.url = data.url;
              if (data.title !== undefined) linkData.title = data.title;
              if (data.target !== undefined) linkData.target = data.target;

              $link.setData(linkData);

              // callback
              this.app.broadcast('addlink.' + type, $link);
          }

          setTimeout(this.selection.restore.bind(this.selection), 0);
      },
      _deleteContents: function(range)
      {
          var html = this.selection.getHtml();
          var parsed = this.utils.parseHtml(html);
          var first = parsed.nodes[0];

          if (first && first.nodeType !== 3)
          {
              var tag = first.tagName.toLowerCase();
              var container = document.createElement(tag);

              this.insertion.insertNode(container, 'start');
          }
          else
          {
              range.deleteContents();
          }
      },
      _getModalData: function()
      {
          var commands;
          if (this._isLink())
          {
             commands = {
                  update: { title: this.lang.get('save') },
                  unlink: { title: this.lang.get('unlink'), type: 'danger' },
                  cancel: { title: this.lang.get('cancel') }
              };
          }
          else
          {
              commands = {
                  insert: { title: this.lang.get('insert') },
                  cancel: { title: this.lang.get('cancel') }
              };
          }

          var modalData = {
              name: 'addlink',
              title: (this._isLink()) ? this.lang.get('link-edit') : this.lang.get('link-insert'),
              handle: (this._isLink()) ? 'update' : 'insert',
              commands: commands
          };


          return modalData;
      },
      _isLink: function()
      {
          return this.currentLink;
      },
      _isCurrentTextChanged: function(data)
      {
          return (this.currentText && this.currentText !== data.text);
      },
      _buildCurrent: function()
      {
          var current = this._getCurrent();
          var data = this.inspector.parse(current);
          var $link;

          if (data.isLink())
          {
              this.currentLink = true;

              $link = data.getLink();
              $link = $R.create('addlink.component', this.app, $link);
          }
          else
          {
              this.currentLink = false;

              $link = $R.create('addlink.component', this.app);
              var linkData = {
                  text: this.selection.getText()
              };

              $link.setData(linkData);
          }

          return $link;
      },
      _getCurrent: function()
      {
          return this.selection.getInlinesAllSelected({ tags: ['a'] })[0];
      },
      _getLinks: function()
      {
          var links = this.selection.getInlines({ all: true, tags: ['a'] });
          var arr = [];
          for (var i = 0; i < links.length; i++)
          {
              var data = this.inspector.parse(links[i]);
              if (data.isLink())
              {
                  arr.push(links[i]);
              }
          }

          return arr;
      },
      _resetCurrent: function()
      {
          this.isCurrentLink = false;
          this.currentText = false;
      },
      _truncateText: function(url)
      {
          return (url && url.length > this.opts.linkSize) ? url.substring(0, this.opts.linkSize) + '...' : url;
      },
      _validateData: function($form, data)
      {
          return (data.url.trim() === '') ? $form.setError('url') : true;
      },
      _setFormFocus: function($form)
      {
          $form.getField('url').focus();
      },
      _setFormData: function($form, $modal)
      {
          var linkData = this.$link.getData();
          var data = {
              url: linkData.url,
              text: linkData.text,
              title: linkData.title,
              target: (this.opts.linkTarget || linkData.target)
          };

          if (!this.opts.linkNewTab) $modal.find('.form-additem-target').hide();
          if (!this.opts.linkTitle) $modal.find('.form-additem-title').hide();

          $form.setData(data);
          this.currentText = $form.getField('text').val();
      }
  });
})(Redactor);

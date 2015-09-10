
var dialogs = {};

function retrieveChatDialogs() {
  // get the chat dialogs list
  //
  QB.chat.dialog.list(null, function(err, resDialogs) {
    if (err) {
      console.log(err);
    } else {

      // repackage dialogs data and collect all occupants ids
      //
      var occupantsIds = [];

      resDialogs.items.forEach(function(item, i, arr) {
        var dialogId = item._id;
        dialogs[dialogId] = item;

        // join room
        if (item.type != 3) {
          QB.chat.muc.join(item.xmpp_room_jid, function() {
             console.log("Joined dialog "+dialogId);
          });
        }

        item.occupants_ids.map(function(userId) {
          occupantsIds.push(userId);
        });
      });

      // load dialogs' users
      //
      updateDialogsUsersStorage(jQuery.unique(occupantsIds), function(){
        // show dialogs
        //
        resDialogs.items.forEach(function(item, i, arr) {
          showOrUpdateDialogInUI(item, false);
        });

        //  and trigger the 1st dialog
        //
        triggerDialog($('#dialogs-list').children()[0], resDialogs.items[0]._id);

        // hide login form
        $("#loginForm").modal("hide");

        // setup attachments button handler
        //
        $("#load-img").change(function(){
          var inputFile = $("input[type=file]")[0].files[0];
          if (inputFile) {
            $("#progress").show(0);
          }

          clickSendAttachments(inputFile);
        });
      });
    }
  });
}

function showOrUpdateDialogInUI(itemRes, updateHtml) {
  var dialogId = itemRes._id;
  var dialogName = itemRes.name;
  var dialogType = itemRes.type;
  var dialogLastMessage = itemRes.last_message;
  var dialogUnreadMessagesCount = itemRes.unread_messages_count;
  var dialogIcon = getDialogIcon(itemRes.type);

  if (dialogType == 3) {
    opponentId    = QB.chat.helpers.getRecipientId(itemRes.occupants_ids, currentUser.id);
    opponentLogin = getUserLoginById(opponentId);
    dialogName    = 'Dialog with ' + opponentLogin;
  }

  if (updateHtml == true) {
  	var updatedDialogHtml = buildDialogHtml(dialogId, dialogUnreadMessagesCount, dialogIcon, dialogName, dialogLastMessage);
  	$('#dialogs-list').prepend(updatedDialogHtml);
  	$('.list-group-item.active .badge').text(0).hide(0);
	} else {
    var dialogHtml = buildDialogHtml(dialogId, dialogUnreadMessagesCount, dialogIcon, dialogName, dialogLastMessage);
    $('#dialogs-list').append(dialogHtml);
	}
}

// add photo to dialogs
function getDialogIcon (dialogType) {
  var groupPhoto = '<img src="images/ava-group.svg" width="30" height="30" class="round">';
  var privatPhoto  = '<img src="images/ava-single.svg" width="30" height="30" class="round">';
  var defaultPhoto = '<span class="glyphicon glyphicon-eye-close"></span>'

  var dialogIcon;
  switch (dialogType) {
    case 1:
      dialogIcon = groupPhoto;
      break;
    case 2:
      dialogIcon = groupPhoto;
      break;
    case 3:
    	dialogIcon = privatPhoto;
      break;
    default:
      dialogIcon = defaultPhoto;
      break;
  }
  return dialogIcon;
}

// show unread message count and new last message
function updateDialogsList(dialogId, text){

  // update unread message count
  var badgeCount = $('#'+dialogId+' .badge').html();
  $('#'+dialogId+'.list-group-item.inactive .badge').text(parseInt(badgeCount)+1).fadeIn(500);

  // update last message
  $('#'+dialogId+' .list-group-item-text').text(text);
}

// Choose dialog
function triggerDialog(element, dialogId){
  // deselect
  var kids = $('#dialogs-list').children();
  kids.removeClass('active').addClass('inactive');

  // select
  $('#'+dialogId).removeClass('inactive').addClass('active');

  $('.list-group-item.active .badge').text(0).delay(250).fadeOut(500);

  $('#messages-list').html('');

  // load chat history
  //
  retrieveChatMessages(dialogs[dialogId], null);

  $('#messages-list').scrollTop($('#messages-list').prop('scrollHeight'));
}

function setupUsersScrollHandler(){
  // uploading users scroll event
  $('.list-group.pre-scrollable.for-scroll').scroll(function() {
    if  ($('.list-group.pre-scrollable.for-scroll').scrollTop() == $('#users_list').height() - $('.list-group.pre-scrollable.for-scroll').height()){

      // get and show users
      retrieveUsersForDialogCreation(function(users) {
        $.each(users, function(index, item){
          showUsers(this.user.login, this.user.id);
        });
      });
    }
  });
}

//
function showUsers(userLogin, userId) {
  var userHtml = buildUserHtml(userLogin, userId);
  $('#users_list').append(userHtml);
}

// show modal window with users
function showNewDialogPopup() {
  $("#add_new_dialog").modal("show");
  $('#add_new_dialog .progress').hide();

  // get and show users
  retrieveUsersForDialogCreation(function(users) {
    $.each(users, function(index, item){
      showUsers(this.user.login, this.user.id);
    });
  });

  setupUsersScrollHandler();
}

// select users from users list
function clickToAdd(forFocus) {
  if ($('#'+forFocus).hasClass("active")) {
    $('#'+forFocus).removeClass("active");
  } else {
    $('#'+forFocus).addClass("active");
  }
}

// create new dialog
function createNewDialog() {
  var usersIds = [];
  var usersNames = [];

  $('.users_form.active').each(function(index) {
    usersIds[index] = $(this).attr('id');
    usersNames[index] = $(this).text();
  });

  $("#add_new_dialog").modal("hide");
  $('#add_new_dialog .progress').show();

  var dialogName;
  var dialogOccupants;
  var dialogType;

  if (usersIds.length > 1) {
    dialogName = currentUser.login+', '+usersNames.join(', ');
    dialogOccupants = usersIds.join(',');
    dialogType = 2;
  } else {
    dialogOccupants = usersIds.join(',');
    dialogType = 3;
  }

  var params = {
    type: dialogType,
    occupants_ids: dialogOccupants,
    name: dialogName
  };

  // create a dialog
  //
  QB.chat.dialog.create(params, function(err, createdDialog) {
    if (err) {
      console.log(err);
    } else {
      console.log("Dialog created with users: " + dialogOccupants);

      var dialogId = createdDialog._id;
      dialogs[dialogId] = createdDialog;

      currentDialog = createdDialog;

      joinToNewDialogAndShow(createdDialog);

      notifyOccupants(createdDialog.occupants_ids, createdDialog._id);

      triggerDialog($('#dialogs-list').children()[0], createdDialog._id);

      $('a.users_form').removeClass('active');
    }
  });
}

//
function joinToNewDialogAndShow(itemDialog) {
  var dialogId = itemDialog._id;
  var dialogName = itemDialog.name;
  var dialogLastMessage = itemDialog.last_message;
  var dialogUnreadMessagesCount = itemDialog.unread_messages_count;
  var dialogIcon = getDialogIcon(itemDialog.type);

  // save dialog to local storage
  dialogs[dialogId] = itemDialog;

  // join if it's a group dialog
  if (itemDialog.type != 3) {
    QB.chat.muc.join(itemDialog.xmpp_room_jid, function() {
       console.log("Joined dialog: " + dialogId);
    });
    opponentLogin = null;
  } else {
    opponentId = QB.chat.helpers.getRecipientId(itemDialog.occupants_ids, currentUser.id);
    opponentLogin = getUserLoginById(opponentId);
    dialogName = chatName = 'Dialog with ' + opponentLogin;
  }

  // show it
  var dialogHtml = buildDialogHtml(dialogId, dialogUnreadMessagesCount, dialogIcon, dialogName, dialogLastMessage);
  $('#dialogs-list').prepend(dialogHtml);
}

//
function notifyOccupants(dialogOccupants, newDialogId) {
  dialogOccupants.forEach(function(itemOccupanId, i, arr) {
    if (itemOccupanId != currentUser.id) {
      var msg = {
        type: 'chat',
        extension: {
          notification_type: 1,
          dialog_id: newDialogId
        },
      };

      QB.chat.send(itemOccupanId, msg);
    }
  });
}

//
function getAndShowNewDialog(newDialogId) {
  QB.chat.dialog.list({_id: newDialogId}, function(err, res) {
    if (err) {
      console.log(err);
    } else {
      joinToNewDialogAndShow(res.items[0])
    }
  });
}

// show modal window with dialog's info
function showDialogInfoPopup() {
  $("#update_dialog").modal("show");
  $('#update_dialog .progress').hide();

  // shwo current dialog's occupants
  setupDialogInfoPopup(currentDialog.occupants_ids, currentDialog.name);
}

// show information about the occupants for current dialog
function setupDialogInfoPopup(occupantsIds, name) {

  // show name
  $('#dialog-name-input').val(name);

  // show occupants
  var logins = [];
  occupantsIds.forEach(function(item, index) {
    login = getUserLoginById(item);
    logins[index] = login;
  });
  $('#all_occupants').text('');
  $('#all_occupants').append('<b>Occupants: </b>'+logins.join(', '));

  // show type
  //
  // private
  if (currentDialog.type == 3) {
    $('.dialog-type-info').text('').append('<b>Dialog type: </b>privat chat');
    $('.new-info').hide();
    $('.push').hide();
    $('#push_usersList').hide();
    $('#update_dialog_button').hide();

  // group
  } else {
    $('.dialog-type-info').text('').append('<b>Dialog type: </b>group chat');
    $('.new-info').show();
    $('.push').show();
    $('#push_usersList').show();
    $('#update_dialog_button').show();

    // get users to add to dialog
    retrieveUsersForDialogUpdate(function(users){
      $.each(users, function(index, item){
        var userHtml = buildUserHtml(this.user.login, this.user.id);
        $('#add_new_occupant').append(userHtml);
      });
    });
    setupScrollHandlerForNewOccupants();
  }
}


function setupScrollHandlerForNewOccupants() {
  // uploading users scroll event
  $('#push_usersList').scroll(function() {
    if  ($('#push_usersList').scrollTop() == $('#add_new_occupant').height() - $('#push_usersList').height()){

      retrieveUsersForDialogUpdate(function(users){
        $.each(users, function(index, item){
          var userHtml = buildUserHtml(this.user.login, this.user.id);
          $('#add_new_occupant').append(userHtml);
        });
      });

    }
  });
}

// for dialog update
function onDialogUpdate() {
  var pushOccupants  = [];
  $('.users_form.active').each(function(index) {
    pushOccupants[index] = $(this).attr('id');
  });

  var dialogName  = $('#dialog-name-input').val().trim();

  var toUpdate = {
      name:     dialogName,
      push_all: {occupants_ids: pushOccupants}
    };

  console.log("Updating the dialog with params: " + JSON.stringify(toUpdate));

  QB.chat.dialog.update(currentDialog._id, toUpdate, function(err, res) {
    if (err) {
      console.log(err);
    } else {
      console.log("Dialog updated");

      var dialogId = res._id;
      dialogs[dialogId] = res;

      currentDialog = res;

      $('#'+res._id).remove();

      showOrUpdateDialogInUI(res, true);
      $('#'+res._id).removeClass('inactive').addClass('active');
    }
  });

  $("#update_dialog").modal("hide");
  $('#dialog-name-input').val('');
  $('.users_form').removeClass("active");
}

// delete currend dialog
function onDialogDelete() {
  if (confirm("Are you sure you want remove the dialog?")) {
    QB.chat.dialog.delete(currentDialog._id, function(err, res) {
      if (err) {
        console.log(err);
      } else {
        console.log("Dialog removed");
        $('#'+currentDialog._id).remove();
      }
    });

    $("#update_dialog").modal("hide");
    $('#update_dialog .progress').show();
  }
}

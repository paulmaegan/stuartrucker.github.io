      var myDataRef = new Firebase('https://oy9v2r9ur0p.firebaseio-demo.com/');
      $('#btn-input').keypress(function (e) {
        if (e.keyCode == 13) {
          var name = $('#nameInput').val();
          var text = $('#btn-input').val();
          myDataRef.push({name: name, text: text});
          $('#btn-input').val('');
        }
      });
      myDataRef.on('child_added', function(snapshot) {
        
        displayChatMessage(snapshot.child("name").val(), snapshot.child("text").val());
        alert(snapshot.child("name").val());
      });
      function displayChatMessage(name, text) {
        var appension = "<li class='left clearfix'>" +
                                  "<div class='chat-body clearfix'>"+
                                        "<div class='header'>"+
                                            "<strong class='primary-font'>"+name + "</strong>"+
                                        "</div>"+
                                        "<p>"+
                                           text + 
                                        "</p>"+
                                    "</div>"+
                                "</li>"+
        $('#messagesDiv').append(appension);
        $('#messagesDiv')[0].scrollTop = $('#messagesDiv')[0].scrollHeight;
      };
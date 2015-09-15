var ref ;

/************************
*Handle Modal*/
$( document ).ready(function() {
	$("#tableOptions").hide();
	$("#hiddenDelete").hide();
	deleteOldUsers();
	getNewUsers();

	ref = new Firebase("https://exoniandatabase.firebaseio.com/")
});

var state = false;
function toggleOptions(){
	if(!state){
		$("#tableOptions").show();
		state = true;
	}else{
		state = false;
		$("#tableOptions").hide();
	}
}

function closeEditor(){
	$('#myModal').modal('hide'); 
}  




/************************
*Handle changes*/

var referson = new Firebase("https://exoniandatabase.firebaseio.com/users");
referson.on('child_added', function(childSnapshot, prevChildKey) {
  		var id = childSnapshot.key();
		var appension = 
                           "<tr id='" + id +"' onclick =\"openEditor('" +id+ "')\" class='subscrib'>"+
                               "<td class = 'First'>" +childSnapshot.child("First").val() + "</td>"+
                               "<td class = 'Last'>" +childSnapshot.child("Last").val() + "</td>"+
                               "<td class = 'Address'>" +childSnapshot.child("Address").val() + "</td>"+
                               "<td class = 'City'>" +childSnapshot.child("City").val() + "</td>"+
                               "<td class = 'State'>" +childSnapshot.child("State").val() + "</td>"+
                                "<td class = 'Zip'>" +childSnapshot.child("Zip").val() + "</td>"+
                                "<td class = 'Country'>" +childSnapshot.child("Country").val() + "</td>"+
                                "<td class = 'Date'>" +
                                childSnapshot.child("date").child("month").val() + "/" + 
                                childSnapshot.child("date").child("day").val() + "/" + 
                                childSnapshot.child("date").child("year").val()+ 
                                 "</td>"+
                                "<td class = 'warnings'>" +childSnapshot.child("warnings").val() + "</td>"+
                           "</tr>";
        $("#subscriberTable").append(appension);
});

referson.on('child_removed', function(oldChildSnapshot) {
  	$("#" + oldChildSnapshot.key()).remove();
  	alert("removing")
});

referson.on('child_changed', function(childSnapshot, prevChildKey) {
  	
  	$("#" + childSnapshot.key() + " .First").text(childSnapshot.child("First").val());
	$("#" + childSnapshot.key() + " .Last").text(childSnapshot.child("Last").val());
	$("#" + childSnapshot.key() + " .Address").text(childSnapshot.child("Address").val());
	$("#" + childSnapshot.key() + " .City").text(childSnapshot.child("City").val());
	$("#" + childSnapshot.key() + " .State").text(childSnapshot.child("State").val());
	$("#" + childSnapshot.key() + " .Country").text(childSnapshot.child("Country").val());
	$("#" + childSnapshot.key() + " .Zip").text(childSnapshot.child("Zip").val());
	$("#" + childSnapshot.key() + " .warnings").text(childSnapshot.child("warnings").val());
	$("#" + childSnapshot.key() + " .Date").text(childSnapshot.child("date").child("month").val() + "/" + childSnapshot.child("date").child("day").val() + "/" + childSnapshot.child("date").child("year").val());
});



function openEditor(value){
	$("#modalTitle").text("Edit User");

	$("#predeleter").show();
	$("#hiddenDelete").hide();

	$("#LastM").val($("#" + value + " .Last").text());
	$("#FirstM").val($("#" + value + " .First").text());
	$("#AddressM").val($("#" + value + " .Address").text());
	$("#CityM").val($("#" + value + " .City").text());
	$("#StateM").val($("#" + value + " .State").text());
	$("#CountryM").val($("#" + value + " .Country").text());
	$("#ZipM").val($("#" + value + " .Zip").text());
	$("#WarningsM").val($("#" + value + " .warnings").text());
	$('#DateM').val(new Date($("#" + value + " .Date").text()).toDateInputValue()); 
	$('#id').text(value);
	$('#myModal').modal('show');


}      


/************************
*Remove users*/




var state = false;

function tdeleteuser(){
	if(state == false) {$("#hiddenDelete").fadeIn();state = true;}
	else{
		$("#hiddenDelete").fadeOut();
		state = false;
	}
}

function deleteUser(){
	
	if(String($("#inputError").val()).toUpperCase() == "EXONIAN"){

		ref.child("users").child($("#id").text()).remove()

		$("#inputError").val("");
		$("#hiddenDelete").hide();
		$('#myModal').modal('hide');
	}else{
		alert("wrong word");
	}
	
}







/************************
*Edit users*/




function saveEditor(){

	var id = $("#id").text();
	alert(id)
	var ref2;
	var adding = true;
	if(id == "Editing"){
		ref2 = ref.child("users").push();
		id=ref2.key();
	}else{
		ref2 = ref.child("users").child(id);
		adding = false;
	}
	alert(id)


	var enteredDate = document.getElementById('DateM').valueAsDate;
	enteredDate.setMinutes(enteredDate.getMinutes() + enteredDate.getTimezoneOffset());
	var day = enteredDate.getDate();
	var month = enteredDate.getMonth() + 1;
	var year = enteredDate.getFullYear();
	

	ref2.child("First").set($("#FirstM").val());
	ref2.child("Last").set($("#LastM").val());
	ref2.child("Address").set($("#AddressM").val());
	ref2.child("City").set($("#CityM").val());
	ref2.child("State").set($("#StateM").val());
	ref2.child("Country").set($("#CountryM").val());
	ref2.child("Zip").set($("#ZipM").val());
	ref2.child("warnings").set($("#WarningsM").val());
	ref2.child("date").child("day").set(day);
	ref2.child("date").child("month").set(month);
	ref2.child("date").child("year").set(year);







	$('#myModal').modal('hide'); 
}
                         

/************************
*Add users*/


function modalAdd(){
	$("#modalTitle").text("Add User");

	//hide the delete button
	$("#predeleter").hide();
	$("#hiddenDelete").hide();

	var d = new Date();
	d.setFullYear(d.getFullYear() + 1);
	$("#LastM").val("");
	$("#FirstM").val("");
	$("#AddressM").val("");
	$("#CityM").val("");
	$("#StateM").val("");
	$("#CountryM").val("");
	$("#ZipM").val("");
	$("#WarningsM").val("0");
	$('#DateM').val(d.toDateInputValue()); 
	$('#id').text("Editing");
	$('#myModal').modal('show');
	first = false;
}

/************************
*Util*/



Date.prototype.toDateInputValue = (function() {
    var local = new Date(this);
    local.setMinutes(this.getMinutes() - this.getTimezoneOffset());
    return local.toJSON().slice(0,10);
});   
	
/************************
*Deleting Old Users*/

//will move to different branch of the firebase
var expiredRef = new Firebase("https://exoniandatabase.firebaseio.com/expired");
function deleteOldUsers(){
	referson.once("value", function(ch) {
          // The callback function will get called twice, once for "fred" and once for "barney"
          ch.forEach(function(as) {
            

              //check if the person is about to expire
            var expire = new Date(as.child("date").child("year").val(), as.child("date").child("month").val(), as.child("date").child("day").val());
            var current = new Date();
            
            if(expire.getTime() > current.getTime() && parseInt(as.child("warnings").val()) > 7){
                alert("getting rid of user")
                var ke = as.key();
                referson.child(ke).remove();
                expiredRef.push(as.val());

            }
          
          });
        });
}

/************************
*Getting new Users from formsite*/
function getNewUsers(){

}
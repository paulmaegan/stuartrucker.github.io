
function formatDate(date) {
  var monthNames = [
  "January", "February", "March",
  "April", "May", "June", "July",
  "August", "September", "October",
  "November", "December"
  ];

  var day = date.getDate();
  var monthIndex = date.getMonth();
  var year = date.getFullYear();

  return day + ' ' + monthNames[monthIndex] + ' ' + year;
  }
    window.onload = function() {
        masterFunc()
    };

    var master = '1R3FEuZara22iPOcLsTEQT7Jbw7jiSPWVN_RnMo4CQZw';
    var online = '1oiVInTnKFQXLrX_l2i_BpUNbdsIabIBfob4qMPJHqyk';
    var online1 = '1Er-RsbzIN21uBmpxlYIsrI0bs-n1-ABAEqo7jXPCL2s';


    function toUpperCase(txt) {
      var str = txt.toLowerCase();
    	 return str.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
    }



    var totalMade = 0;

    //append data from master spreadsheet
    function masterFunc() {


        Tabletop.init({
                key: online,
                callback: onlineFunc,
                simpleSheet: true
            })
            //get data from first spreadsheet

    }


    var info;
    var confirm;



    function onlineFunc(data, tabletop) {
        info = data;

        Tabletop.init({
            key: online1,
            callback: online1Func,
            simpleSheet: true
        })


    }

    function online1Func(data, tabletop) {
        confirm = data;

    }

    function confirmemail(email){


        for (var i = info.length-1; i>=0; i--) {

            var person = info[i];

            if(person["Email Address"] != email){
              continue;
            }



            // console.log(person);
            for (var k = confirm.length-1; k>=0 ; k--) {
                if (person.id === confirm[k].id && confirm[k].PaymentStatus === "Success") {
                    var potential = new Date(person["Finish Time"]);
                    potential.setFullYear(new Date().getFullYear() + 1);
                    return email + ": subscribed until " + formatDate(potential)
                }
            }
        }
        return "0";
    }

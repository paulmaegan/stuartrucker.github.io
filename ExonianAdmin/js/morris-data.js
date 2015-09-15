var checkNumbs = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
var onlineNumbs = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
var timePeriodsStrings = [];




function getDayDif(firstDate, secondDate) {
    var oneDay = 24 * 60 * 60 * 1000;
    return Math.round(Math.abs((firstDate.getTime() - secondDate.getTime()) / (oneDay)));
}
var dataGotten = false;


  
    var currentDate = new Date();
    currentDate.setFullYear(currentDate.getFullYear() + 1)

    var refUsers = new Firebase("https://exoniandatabase.firebaseio.com/users");
    
    var ink = 0;
    refUsers.once("value", function(snapshot) {
       
        var max = snapshot.numChildren();
        snapshot.forEach(function(childSnapshot) {
            var d = new Date(
                childSnapshot.child("date").child("month").val() + "/" +
                childSnapshot.child("date").child("day").val() + "/" +
                childSnapshot.child("date").child("year").val())
            if (d.getTime() < currentDate.getTime()) {

                var index = Math.round(getDayDif(d, currentDate) / 91.25);
                if (index < 10 && index > -1) {
                    checkNumbs[index]++;
                    
                }

            }
            
            ink ++;
            if(max == ink) {
                
                graph1.setData(data());
            }
        });
    });

    var countExpire = 0;
    var refExpired = new Firebase("https://exoniandatabase.firebaseio.com/expired");
    refUsers.once("value", function(snapshot) {
        var maxEx = snapshot.numChildren();
       
        snapshot.forEach(function(childSnapshot) {
             var d = new Date(
                childSnapshot.child("date").child("month").val() + "/" +
                childSnapshot.child("date").child("day").val() + "/" +
                childSnapshot.child("date").child("year").val())
            if (d.getTime() < currentDate.getTime()) {

                var index = Math.round(getDayDif(d, currentDate) / 91.25);
                if (index < 10 && index > -1) {
                    checkNumbs[index]++;
                }

            }
            countExpire++;
            if(countExpire == maxEx){
                graph1.setData(data());
            }

        });
    });
   
    

    var year = currentDate.getFullYear();
    var quarter = Math.round(currentDate.getMonth() / 3);

    for (var i = 0; i < 10; i++) {
        timePeriodsStrings[i] = year.toString() + " Q" + quarter;
        quarter--;
        if (quarter <= 0) {
            quarter = 4;
            year--;
        }
    }

   




    var graph1 = Morris.Area({
        element: 'morris-area-chart',
        data: [{
            period: timePeriodsStrings[9],
            check: checkNumbs[0],
            online: onlineNumbs[0]

        }, {
            period: timePeriodsStrings[8],
            check: checkNumbs[1],
            online: onlineNumbs[1]

        }, {
            period: timePeriodsStrings[7],
            check: checkNumbs[2],
            online: onlineNumbs[2]

        }, {
            period: timePeriodsStrings[6],
            check: checkNumbs[3],
            online: onlineNumbs[3]

        }, {
            period: timePeriodsStrings[5],
            check: checkNumbs[4],
            online: onlineNumbs[4]

        }, {
            period: timePeriodsStrings[4],
            check: checkNumbs[5],
            online: onlineNumbs[5]

        }, {
            period: timePeriodsStrings[3],
            check: checkNumbs[6],
            online: onlineNumbs[6]

        }, {
            period: timePeriodsStrings[2],
            check: checkNumbs[7],
            online: onlineNumbs[7]

        }, {
            period: timePeriodsStrings[1],
            check: checkNumbs[8],
            online: onlineNumbs[8]

        }, {
            period: timePeriodsStrings[0],
            check: checkNumbs[9],
            online: onlineNumbs[9]

        }],
        xkey: 'period',
        ykeys: ['check', 'online'],
        labels: ['Check', 'Online'],
        pointSize: 2,
        hideHover: 'auto',
        resize: true
    });
function data(){
    var ret = [];
    for(var i = 0; i < 10; i ++){
        ret.push({
            period: timePeriodsStrings[9-i],
            check: checkNumbs[i],
            online: onlineNumbs[i]
        })
    }
    return ret;

}
    


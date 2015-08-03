Arduino.connect("stuart");

Arduino.analogRead(0,moistureChange0);
function moistureChange0(value){
	var newHeight = 207-((value * 200)/1023)

	$("#0 .progress-bar").css("width",newHeight + "%")
}
Arduino.analogRead(1,moistureChange1);
function moistureChange1(value){
	var newHeight = 207-((value * 200)/1023)
	
	$("#1.progress-bar").css("width",newHeight + "%")
}
Arduino.analogRead(2,moistureChange2);
function moistureChange2(value){
	var newHeight = 207-((value * 200)/1023)
	
	$("#2 .progress-bar").css("width",newHeight + "%")
}
Arduino.analogRead(3,moistureChange3);
function moistureChange3(value){
	var newHeight = 207-((value * 200)/1023)
	
	$("#3 .progress-bar").css("width",newHeight + "%")
}
Arduino.analogRead(4,moistureChange4);
function moistureChange4(value){
	var newHeight = 207-((value * 200)/1023)
	
	$("#4 .progress-bar").css("width",newHeight + "%")
}
Arduino.analogRead(5,moistureChange5);
function moistureChange5(value){
	var newHeight = 207-((value * 200)/1023)
	
	$("#5 .progress-bar").css("width",newHeight + "%")
}
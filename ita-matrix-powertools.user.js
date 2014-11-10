// ==UserScript==
// @name DL/ORB Itinary Builder
// @namespace http://matrix.itasoftware.com
// @description Builds fare purchase links
// @version 0.4
// @grant none
// @include http://matrix.itasoftware.com/view/details*
// @include http://matrix.itasoftware.com/view/calendar*
// @include http://matrix.itasoftware.com/search.htm*
// @include http://matrix.itasoftware.com/?*
// @include http://matrix.itasoftware.com/
// ==/UserScript==

//Version 0.4
//2014-11-09 Edited by Steppo (Added monthly navigation to calendar, added retry for details if content is loading slow, added flights as object (see data var ) , added Farefreaks, added GCM)
//Version 0.3a
//2014-11-01 Edited by Steppo (shortened some regex and added support for german matrix)
//Written by paul21 of FlyerTalk.com
//http://www.flyertalk.com/forum/members/paul21.html
//Copyright Reserved -- At least share with credit if you do


// global retrycount for setup
var retrycount=1;


window.addEventListener('load', function() {
	if (window.location.href.indexOf("http://matrix.itasoftware.com/view/calendar") !=-1){
		createmonthlinks();
		setTimeout(function(){makenavigationvisible()}, 500); 
	} else if (window.location.href.indexOf("http://matrix.itasoftware.com/view/details") !=-1) {
		setTimeout(function(){fePS()}, 500);   
	} else if (window.location.href.indexOf("http://matrix.itasoftware.com/search.htm") !=-1 || window.location.href.indexOf("http://matrix.itasoftware.com/?") !=-1 || window.location.href == "http://matrix.itasoftware.com/") {
		setTimeout(function(){buildmain()}, 100);   
	}  

}, false);


/**************************************** General Functions *****************************************/
//Parses all of the outputs of regexp matches into an array
function exRE(str,re){
	var ret= new Array();
	var m;
	var i=0;
	while( (m = re.exec(str)) != null ) {
		if (m.index === re.lastIndex) {
			re.lastIndex++;
		}
		for (k=1;k<m.length;k++) {
			ret[i++]=m[k];
		}
	}
	return ret;
}
function hasClass(element, cls) {
	return (' ' + element.className + ' ').indexOf(' ' + cls + ' ') > -1;
}

function inArray(needle, haystack) {
	var length = haystack.length;
	for(var i = 0; i < length; i++) {
		if(haystack[i] == needle) return true;
	}
	return false;
}
function MonthnameToNumber(month){
	var monthnames=["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP","OCT", "NOV", "DEC"];
	return (monthnames.indexOf(month.toUpperCase())+1);
}
function getFlightYear(day,month){
	//Do date magic
	var d = new Date();
	var cmonth=d.getMonth();
	var cday=d.getDate();
	var cyear=d.getFullYear();
	// make sure to handle the 0-11 issue of getMonth()
	if (cmonth > (month-1) || (cmonth == (month-1) && day < cday)) {
		cyear += 1; //The flight is next year
	}
	return cyear;
}
function return12htime(match){
	var regex = /([01]?\d)(:\d{2})(AM|PM|am|pm| AM| PM| am| pm)/g;
	match = regex.exec(match);
	var offset = 0;
	match[3]=trimStr(match[3]);
	if  ((match[3]=='AM' || match[3]=='am') && match[1]=='12'){offset = -12}
	else if  ((match[3]=='PM' || match[3]=='pm') && match[1]!='12'){ offset = 12}
	return (+match[1] + offset) +match[2];        
};
function trimStr(x) {
	return x.replace(/^\s+|\s+$/gm,'');
}
function getcabincode(cabin){
	switch(cabin) {
	case "E":
		cabin=0;
		break;
	case "C":
		cabin=0;
		break;
	case "P":
		cabin=1;
		break;
	case "B":
		cabin=2;
		break;
	case "F":
		cabin=3;
		break;
	default:
		cabin=0;
	}
	return cabin;
}
/********************************************* Main *********************************************/
function buildmain(){
	// retry if itin not loaded    
	if (document.getElementById("searchFormsContainer") === undefined) { 
		retrycount++;
		if (retrycount>20) {
			console.log("Error Content not found.");
			return false;
		};

		setTimeout(function(){buildmain()}, 100);   
		return false;
	};
	//open advanced routing
	if ( !hasClass(document.getElementById("ita_form_SliceForm_0"),"dijitHidden") && document.getElementById("ita_layout_CollapsiblePane_1").getAttribute("displayed")=="false") {
		document.getElementById('sites_matrix_layout_RouteLanguageToggleLink_0').click();
	}
}



/********************************************* Calendar *********************************************/
function makenavigationvisible() {  
	document.getElementById("calendarUpdateForm2").style.display='';
}

function createmonthlinks() {
	linktoimages="http://matrix.itasoftware.com/js/ita/themes/ita/images/"  
	newtd = document.createElement('td');
	newtd.setAttribute('id','goprevmonth');
	newtd.setAttribute('style','padding-right:10px;');
	newimg = document.createElement('img');
	newimg.setAttribute('src',linktoimages+'arrowbtn_prev.png');
	newtd.appendChild(newimg);
	insert=document.getElementById("widget_monthSelect").parentNode;
	insert.parentNode.insertBefore(newtd, insert);

	newtd = document.createElement('td');
	newtd.setAttribute('id','gonextmonth');
	newtd.setAttribute('style','padding-right:10px;');
	newimg = document.createElement('img');
	newimg.setAttribute('src',linktoimages+'arrowbtn_next.png');
	newtd.appendChild(newimg);
	insert=document.getElementById("widget_monthSelect").parentNode;
	insert.parentNode.insertBefore(newtd, insert.nextSibling);

	document.getElementById('goprevmonth').onclick=function(){changemonth (-1);}
	document.getElementById('gonextmonth').onclick=function(){changemonth (1);}
}


function changemonth (change) {  
	if (itaLocale=="de"){
		var sep=".";
		var mpos=1;  
	} else {
		var sep="/";
		var mpos=0; 
	}
	var date =document.getElementById('monthSelect').value.split(sep);
	date[0]=parseInt(date[0]);
	date[1]=parseInt(date[1]);
	date[2]=parseInt(date[2]);
	date[mpos]+=change;
	if (date[mpos]>=13) {  
		date[2]+=Math.floor(date[mpos]/12);
		date[mpos]-=(Math.floor(date[mpos]/12)*12);
	} else if (date[mpos]<=0){
		date[2]+=Math.floor((date[mpos]-1)/12);
		date[mpos]+=(Math.abs(Math.floor(date[mpos]/12))*12);
		if (date[mpos]==0) date[mpos]=12;
	}
	if (date[0]<10 && itaLocale=="de") {date[0]="0"+date[0]; }
	if (date[1]<10 && itaLocale=="de") {date[1]="0"+date[1]; }
	date=date.toString().replace(/,/g, sep); 
	document.getElementById('monthSelect').value=date;
	document.getElementById('calendarUpdateButton').click();
	setTimeout(function(){makenavigationvisible()}, 200);
}

/********************************************* Link Creator *********************************************/
//Primary function for extracting flight data from ITA/Matrix
function fePS() {
	var carrieruarray= new Array(); 
	var data= new Array();
	var currentdate=new Date();  


	// retry if itin not loaded    
	if (document.getElementById("itineraryNode").innerHTML === "" ) { 
		retrycount++;
		if (retrycount>20) {
			console.log("Error Content not found.");
			return false;
		};

		setTimeout(function(){fePS()}, 500);   
		return false;
	}; 
	//Searches through inner-html of div itineraryNode
	var itinHTML = document.getElementById("itineraryNode").innerHTML;
	//Find carrier
	var re=/airline_logos\/35px\/(\w\w)\.png/g;
	var carriers = new Array();
	carriers = exRE(itinHTML,re);
	//new code by 18sas 28-Oct-2014
	var re = /airline_logos\/35px\/\w\w\.png\"\salt\=\"(.*?)\"\stitle/g;
var airlineName = new Array();
airlineName = exRE(itinHTML, re);
//end new code
// build the array of unique carriers  
for (i=0;i<carriers.length;i++) {
if (!inArray(carriers[i],carrieruarray)) {carrieruarray.push(carriers[i])};
}  
	

//Currency in EUR?
var eurcur=0;
var re=/(€)/g;
var speicher = new Array();
speicher = exRE(itinHTML,re);
if (speicher.length>1) eurcur=1;
var usdcur=0;
if (eurcur==0){
var re=/($)/g;
var speicher = new Array();
speicher = exRE(itinHTML,re);
if (speicher.length>1) usdcur=1;
}
//Find Airports
var re=/(strong)*\>[^\(\<]*\((\w{3})[^\(\<]*\((\w{3})/g;
var airports= new Array();
var tmp_airports= new Array();
var legNum = new Array();
var legAirports = new Array();
tmp_airports = exRE(itinHTML,re);

//Find Date
var re=/(strong)*\>[^\(\<]*\(\w{3}[^\(\<]*\(\w{3}[^\,]*\,\s*([a-zA-Z0-9]{1,3})\.?\s*([a-zA-Z0-9ä]{1,3})/g;
var tmp_airdate= new Array();
var airdate = new Array();
var legAirdate = new Array();
tmp_airdate = exRE(itinHTML,re);
if (itaLocale=="de"){
// lets swap values if german language
for (var i = 0; i < tmp_airdate.length; i+=3) {
var speicher=tmp_airdate[i+1]
tmp_airdate[i+1]=tmp_airdate[i+2].replace(/ä/g, "a").replace(/i/g, "y").replace(/Dez/g, "Dec").replace(/Okt/g, "Oct");
tmp_airdate[i+2]=speicher;
}
}
var monthnames=["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP","OCT", "NOV", "DEC"];
//Find times
var re=/dijitReset departure\"\>[^0-9]+(.*?)\<\/td\>/g;
var deptimes= new Array();
deptimes = exRE(itinHTML,re);

var re=/dijitReset arrival\"\>[^0-9]+(.*?)\<\/td\>/g;
var arrtimes= new Array();
arrtimes = exRE(itinHTML,re);
if (itaLocale!="de"){
// take care of 12h
for (var i = 0; i < deptimes.length; i++) {
	deptimes[i]=return12htime(deptimes[i]);
	arrtimes[i]=return12htime(arrtimes[i]);
}
}


//Find flight number
//next line modified by 18sas 28-Oct-2014
var re=/dijitReset carrier\"\>(.*?)\<\/td\>/g;
var flightnumStrs= new Array();
flightnumStrs = exRE(itinHTML,re);
var flightnums = new Array();
//Code adopted from 18sas
for (i=0;i<flightnumStrs.length;i++) {
//new code by 18sas 28-Oct-2014
var flightNoRegExpString = airlineName[i].replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + '\\s([0-9]*)';
var flightNoRegExp = new RegExp(flightNoRegExpString, 'g');
flightnums[i] = exRE(flightnumStrs[i], flightNoRegExp);
//console.log('flightNoRegExpString[' + i + ']=' + flightNoRegExpString);
//console.log('flightNoRegExp[' + i + ']=' + flightNoRegExp.toString());
//console.log('flightNo[' + i + ']=' + flightNo.toString());
//end new code
}

//Find Book Class
var re = /\((\w)\)/g;
var bookclass = new Array();
bookclass = exRE(itinHTML,re);
//Find Class of Service
// C - Coach / B - Business / F - First on ORB
// B5-Coach / B2-Business on DL
var re = /(\w)[\w]+\&nbsp\;\(\w\)/g;
var classofservice = new Array();
classofservice = exRE(itinHTML,re);
for (i=0;i<classofservice.length;i++)
{
if (classofservice[i] == 'E')
{
classofservice[i] = 'C';
}
}
//Find leg divider
var basisHTML = document.getElementById("ita_layout_RoundedPane_1").innerHTML;
if (itaLocale=="de"){
var re=/Airline\s\w\w\s(\w+)\s[\w{3}]/g;
} else {
var re=/Carrier\s\w\w\s(\w+)\s[\w{3}]/g;
}
var fareBasis=new Array();
fareBasis=exRE(basisHTML,re);
var re=/farePrice\"\>[^0-9]*([0-9,.]+)/g;
var farePrice = new Array();
farePrice = exRE(itinHTML,re);
if (itaLocale=="de"){
var re=/Gesamtpreis\sfür\s([0-9])\sPassagier/g;
} else {
var re=/Total\scost\sfor\s([0-9])\spassenger/g;
}
var numPax = new Array();
numPax = exRE(itinHTML,re);
var k=-1;
var j=0;
var datapointer=0;  
var legobj={};
// lets try to build an structured object  
//alert(tmp_airports.join('\n'));
for(i=0;i<tmp_airports.length;i+=3) {

	if (tmp_airports[i] == "strong" ) //Matches the heading airport
	{
		if (k>=0) {data.push(legobj);}
		k++;
		legobj={};
		//lets build the outer structure
		legobj["orig"]=tmp_airports[i+1];
		legobj["dest"]=tmp_airports[i+2];
		legobj["date"]={};
		legobj["date"]["day"]=parseInt(tmp_airdate[i+2]);
		legobj["date"]["month"]=MonthnameToNumber(tmp_airdate[i+1]);
		legobj["date"]["year"]=getFlightYear(legobj["date"]["day"],legobj["date"]["month"]);
		legobj["deptime"] = deptimes[datapointer];
		legobj["seg"] = new Array();
		legAirports[2*k]=tmp_airports[i+1];
		legAirports[2*k+1]=tmp_airports[i+2];
		legAirdate[2*k]=tmp_airdate[i+1];
		legAirdate[2*k+1]=tmp_airdate[i+2];
		if (tmp_airports.length <= i+3 || tmp_airports[i+3] == "strong") //Single flight in leg
		{                       
			speicher={};
			speicher["orig"]=tmp_airports[i+1];
			speicher["dest"]=tmp_airports[i+2];
			speicher["date"]={};
			speicher["date"]["day"]=legobj["date"]["day"];
			speicher["date"]["month"]=legobj["date"]["month"];
			speicher["date"]["year"]=legobj["date"]["year"];
			speicher["deptime"]=deptimes[datapointer];  
			speicher["arrtime"]=arrtimes[datapointer];  
			speicher["carrier"]=carriers[datapointer];
			speicher["fnr"]=flightnums[datapointer][0];
			speicher["cabin"]=getcabincode(classofservice[datapointer]);
			legobj["seg"].push(speicher);
			datapointer++;
			legNum[j]=k;
			airdate[j]=tmp_airdate[i+1];
			airports[j++]=tmp_airports[i+1];
			legNum[j]=k;
			airdate[j]=tmp_airdate[i+2];
			airports[j++]=tmp_airports[i+2];
		}
	} else {
		speicher={};
			speicher["orig"]=tmp_airports[i+1];
			speicher["dest"]=tmp_airports[i+2];
			speicher["date"]={};
			speicher["date"]["day"]=parseInt(tmp_airdate[i+2]);
			speicher["date"]["month"]=MonthnameToNumber(tmp_airdate[i+1]);
			speicher["date"]["year"]=getFlightYear(speicher["date"]["day"],speicher["date"]["month"]);
			speicher["deptime"]=deptimes[datapointer];  
			speicher["arrtime"]=arrtimes[datapointer];  
			speicher["carrier"]=carriers[datapointer];
			speicher["fnr"]=flightnums[datapointer][0];
			speicher["cabin"]=getcabincode(classofservice[datapointer]);
			datapointer++;
			legobj["seg"].push(speicher);
		//Reached a set of two airports in current leg
		legNum[j]=k;
		airdate[j]=tmp_airdate[i+1];
		airports[j++]=tmp_airports[i+1];
		legNum[j]=k;
		airdate[j]=tmp_airdate[i+2];
		airports[j++]=tmp_airports[i+2];
	}
}
data.push(legobj); // push of last leg


//console.log(data); //Remove to see flightstructure


//Find basis legs
if (itaLocale=="de"){
var re=/Strecke\(n\) ([\w\(\)\s\-,]+)/g;
} else {
var re=/Covers ([\w\(\)\s\-,]+)/g;
}
var fareBasisPerFlight = new Array();
var basisLegNum = new Array();
var tmpFareStr = exRE(basisHTML,re);
var j=0;
var l=0;
for (i=0;i<tmpFareStr.length;i++) {
var re=/(\w\w\w)\-(\w\w\w)/g;
var tmpSegsInBasis = exRE(tmpFareStr[i],re);
//alert(tmpSegsInBasis.join('\n'));
for (k=0;k<tmpSegsInBasis.length/2;k++) {
var cont=10;
while(cont >= 1) {
cont--;
basisLegNum[j]=l;
fareBasisPerFlight[j++] = fareBasis[l];
if (airports[2*j-1] == tmpSegsInBasis[k*2+1]) {
cont =0;
}
}
}
l++;
}
var pricing = farePrice[0];
if (itaLocale=="de"){
pricing=pricing.replace(/\./g,"").replace(/\,/g,".");
} else {
pricing=pricing.replace(/\,/g,"");
}

var numSegments=flightnums.length;
var numLegs = legAirports.length/2;
var flightDateNumStr = new Array(); //Padded string of date like "09" "08" etc
var flightDateNum = new Array(); //Numerical day
var flightDateYear = new Array(); //Numerical year > 2000
var flightDateMonthNum = new Array(); //Month 1-12
var flightDateMonthStr = new Array(); //Month in text form "FEB" etc
//Will parse date info into common pieces needed for date formatting
for (i=0;i<numSegments;i++) {
var dateMonth=airdate[i*2].toUpperCase();
var dateNumStr=airdate[1+i*2];
var dateNum=parseInt(dateNumStr);
//Add leading 0 if needed
if (dateNum < 10) {
dateNumStr = "0" + dateNumStr;
}
var d = new Date();
var cmonth=d.getMonth();
var cday=d.getDate();
var cyear=d.getFullYear();
var pmonth=0; //The flight month in 0-11
for (j=0;j<=monthnames.length;j++) {
if (monthnames[j] == dateMonth) {
pmonth=j;
}
}
if (cmonth > pmonth || (cmonth == pmonth && dateNum < cday)) {
cyear += 1; //The flight is next year
}
flightDateNumStr[i] = dateNumStr;
flightDateNum[i] = dateNum;
flightDateYear[i] = cyear;
flightDateMonthNum[i] = pmonth+1;
flightDateMonthStr[i] = dateMonth;
}




var deltaURL ="http://";
	if (itaLocale=="de"){
		// make it local
		deltaURL +="de";
	} else {
		deltaURL +="www";
	}
	deltaURL +=".delta.com/booking/priceItin.do?dispatchMethod=priceItin&tripType=multiCity&cabin=B5-Coach";
	if(eurcur==1){
		// doesnt change anything, because delta doesnt even care..
		deltaURL +="&currencyCd=EUR";
	} else {
		deltaURL +="&currencyCd=USD";
	}
	if (itaLocale=="de"){
		deltaURL +="&exitCountry=DE";
	} else {
		deltaURL +="&exitCountry=US";
	}
	for (i=0;i<numSegments;i++) {
		var segstr="";
		segstr += "&itinSegment[" + i.toString() + "]=" + legNum[i*2] + ":";
		//segstr += "&itinSegment[" + i.toString() + "]=" + basisLegNum[i] + ":";
		segstr += bookclass[i] + ":";
		segstr += airports[i*2] + ":" + airports[1+i*2] + ":";
		segstr += carriers[i] + ":";
		segstr += flightnums[i] + ":";
		segstr += flightDateMonthStr[i] + ":";
		segstr += flightDateNumStr[i] + ":";
		segstr += flightDateYear[i].toString() + ":0";
		deltaURL += segstr;
	}
	deltaURL += "&fareBasis="+fareBasis[0];
	for (i=1;i<fareBasis.length;i++) {
		deltaURL += ":"+fareBasis[i];
	}
	deltaURL += "&price="+pricing;
	deltaURL += "&numOfSegments=" + numSegments.toString() + "&paxCount=" + numPax[0];
	LDLB(deltaURL);
	var orbitzUrl = "/shop/home?type=air&source=GOOGLE_META&searchHost=ITA&ar.type=multiCity&strm=true";
	var selectKey = "";
	//Build multi-city search based on legs
	for (i=0;i<numLegs;i++) {
		//Do date magic
		var legDateMonthStr=legAirdate[i*2].toUpperCase();
		var legDateNumStr=legAirdate[1+i*2];
		var legDateNum=parseInt(legDateNumStr);
		var d = new Date();
		var cmonth=d.getMonth();
		var cday=d.getDate();
		var cyear=d.getFullYear();
		var pmonth=0; //The flight month in 0-11
		for (j=0;j<=monthnames.length;j++) {
			if (monthnames[j] == legDateMonthStr) {
				pmonth=j;
			}
		}
		if (cmonth > pmonth || (cmonth == pmonth && dateNum < cday)) {
			cyear += 1; //The flight is next year
		}
		var legDateYear=cyear;
		var legDateMonthNum=pmonth+1;
		var iStr = i.toString();
		orbitzUrl += "&ar.mc.slc["+iStr+"].orig.key=" + legAirports[i*2];
		orbitzUrl += "&_ar.mc.slc["+iStr+"].originRadius=0";
		orbitzUrl += "&ar.mc.slc["+iStr+"].dest.key=" + legAirports[i*2+1];
		orbitzUrl += "&_ar.mc.slc["+iStr+"].destinationRadius=0";
		var twoyear = legDateYear%100;
		var mstr = legDateMonthNum.toString();
		orbitzUrl += "&ar.mc.slc["+iStr+"].date=" + mstr + "/" + legDateNumStr + "/" + twoyear.toString();
		orbitzUrl += "&ar.mc.slc["+iStr+"].time=Anytime";
	}
	//Build select key based on segments
	for (i=0;i<numSegments;i++) {
		var twoyear = flightDateYear[i]%100;
		var mstr = flightDateMonthNum[i].toString();
		if ( flightDateMonthNum[i] < 10) {
			mstr="0"+mstr;
		}
		selectKey += carriers[i] + flightnums[i] + airports[i*2] + airports[i*2+1] + mstr + flightDateNumStr[i] + classofservice[i];
		if ((i+1)<numSegments) {
			selectKey+= "_";
		}
	}
	orbitzUrl += "&ar.mc.numAdult=" + numPax[0];
	orbitzUrl += "&ar.mc.numSenior=0&ar.mc.numChild=0&ar.mc.child[0]=&ar.mc.child[1]=&ar.mc.child[2]=&ar.mc.child[3]=&ar.mc.child[4]=&ar.mc.child[5]=&ar.mc.child[6]=&ar.mc.child[7]=&search=Search Flights&ar.mc.nonStop=true&_ar.mc.nonStop=0&_ar.mc.narrowSel=0&ar.mc.narrow=airlines&ar.mc.carriers[0]=&ar.mc.carriers[1]=&ar.mc.carriers[2]=&ar.mc.cabin=C";
	orbitzUrl += "&selectKey=" + selectKey;
	if (usdcur==1) {
		//lets do this when USD is cur
		var priceval = parseFloat(pricing) + 6.99;
		orbitzUrl += "&userRate.price=USD|" + priceval.toString();
	}
	LORBB(orbitzUrl);
	var skipseg = new Array();
	for(i=0;i<numSegments-1;i++) {
		skipseg[i]=0;
	}
	skipseg[i]=0;
	skipseg[i+1]=0;
	for(i=0;i<numSegments-1;i++) {
		if (parseInt(flightnums[i]) == parseInt(flightnums[i+1])) {
			skipseg[i+1]=1;
		}	
	}
	//alert(skipseg.join('\n'));
	

	var uaUrl='{\"post\": {\"pax\": '+numPax[0];
	uaUrl += ', \"trips\": [';


	var lastLegNum=-1;
	
	for(i=0;i<numSegments;i++) {
		
		
		if (legNum[i*2] != lastLegNum) {
			lastLegNum=legNum[i*2];
			uaUrl += '{\"origin\": \" \", \"dest\": \" \", \"dep_date\": \" \", \"segments\": [';
		}
		if (skipseg[i] == 0)
		{
			uaUrl += '{\"origin\": \"' + airports[i*2] + '\", \"';
			var mstr = flightDateMonthNum[i].toString();
			
			uaUrl += 'dep_date\": "' + mstr + '/' + flightDateNum[i].toString() + '/' + flightDateYear[i].toString() + '\", \"dest_date\": \" \", ';
			if (skipseg[i+1]==1) {
				uaUrl += '\"dest\": "' + airports[i*2+3] + '\",';
			}else{
				uaUrl += '\"dest\": "' + airports[i*2+1] + '\",';
			}
			uaUrl += ' \"flight_num\": '+flightnums[i];
			uaUrl += ', \"carrier\": "' + carriers[i];
			uaUrl += '\", \"fare_code\": \"' + fareBasisPerFlight[i] + '\"}';
		}
		if ((legNum.length > (i+1)*2 && legNum[(i+1)*2] != lastLegNum) || legNum.length <= (i+1)*2  ) {
			var uaCabCode = 'Coach';
			if (classofservice[0] == 'B') {
				uaCabCode='Business';
			}
			else if (classofservice[0] == 'F') {
				uaCabCode='First';
			}
			uaUrl += '], \"cabin\": \"' + uaCabCode + '\"}';
			//if (legNum.length > (i+1)*2)
			uaUrl += ',';
		}else if ((i+1)<numSegments && skipseg[i+1] == 0) {
			uaUrl+= ",";
		}
	}

	
	//uaUrl[uaUrl.length-1] = ' ';
	uaUrl = uaUrl.substring(0,uaUrl.length-1);
	uaUrl += ']}, \"kind\": \"flight\", \"provider_code\": \"UA\" }';
	UALB(uaUrl);
	var usUrl = "https://shopping.usairways.com/Flights/Passenger.aspx?g=goo&c=goog_US_pax";
	usUrl += "&a=" + numPax[0];
	usUrl += "&s=" + classofservice[0].toLowerCase() ;
	var cFnum=0;
	var lastLegNum=-1;
	for (i=0;i<numSegments;i++) {
		if (legNum[i*2] != lastLegNum) {
			lastLegNum=legNum[i*2];
			cFnum=0;
		}
		cFnum++;
		var cLegNum = legNum[i*2] + 1;
		var idstr = cLegNum.toString() + cFnum.toString();
		usUrl += "&o"+idstr+"=" + airports[i*2] + "&d"+idstr+"=" + airports[i*2+1] + "&f"+idstr+"=" + flightnums[i];
		usUrl += "&t"+idstr+"=" + flightDateYear[i].toString() + flightDateMonthNum[i].toString() + flightDateNumStr[i] + "0000";
		usUrl += "&x"+idstr+"=" + fareBasisPerFlight[i];
	}
	USLB(usUrl);

	//*** Farefreaksstuff ****//
	printFarefreaks (data, numPax[0],0);
	printFarefreaks (data, numPax[0],1);
	//*** GCM ****//
	printGCM (data);

}

function printFarefreaks (data,pax,method=0){
	var carrieruarray = new Array();
	var mincabin=3;
	var segsize=0;  
	var farefreaksurl = "https://www.farefreaks.com/landing/landing.php?";
	if (itaLocale=="de"){
		farefreaksurl +="lang=de";
	} else {
		farefreaksurl +="lang=us";
	}
	farefreaksurl += "&target=flightsearch&referrer=matrix";
	//Build multi-city search based on legs
	for (var i=0;i<data.length;i++) {
		if (method!=1){
			farefreaksurl += "&orig["+segsize+"]=" + data[i]["orig"];
			farefreaksurl += "&dest["+segsize+"]=" + data[i]["dest"];
			farefreaksurl += "&date["+segsize+"]="+data[i]["date"]["year"].toString() + "-" + data[i]["date"]["month"] + "-" + data[i]["date"]["day"] + "_"+data[i]["deptime"]+":00";
			farefreaksurl += "&validtime["+segsize+"]=1";
			segsize++; 
		} 
		for (var j=0;j<data[i]["seg"].length;j++) {
			if (method==1){
				farefreaksurl += "&orig["+segsize+"]=" + data[i]["seg"][j]["orig"];
				farefreaksurl += "&dest["+segsize+"]=" + data[i]["seg"][j]["dest"];
				farefreaksurl += "&date["+segsize+"]="+data[i]["seg"][j]["date"]["year"].toString() + "-" + data[i]["seg"][j]["date"]["month"] + "-" + data[i]["seg"][j]["date"]["day"] + "_"+data[i]["seg"][j]["deptime"]+":00";
				farefreaksurl += "&validtime["+segsize+"]=1";
				segsize++;  
			}         
			if (data[i]["seg"][j]["cabin"]<mincabin){mincabin=data[i]["seg"][j]["cabin"]};  
			if (!inArray(data[i]["seg"][j]["carrier"],carrieruarray)){carrieruarray.push(data[i]["seg"][j]["carrier"])};  
		}
	}
	farefreaksurl += "&adult="+pax;  
	farefreaksurl += "&cabin="+mincabin;  
	farefreaksurl += "&child=0&childage[]=&flexible=0";
	if (method==1){  
		farefreaksurl += "&nonstop=1";
		desc="Based on "+segsize+" segments";
	} else {
		farefreaksurl += "&nonstop=0";  
		desc="Based on "+segsize+" legs";
	}
	if (carrieruarray.length <= 3) {farefreaksurl += "&carrier="+ carrieruarray.toString();}
	if (segsize<=6) {printUrl(farefreaksurl,"FF",desc)};
}

function printGCM (data){

	var url = "http://www.gcmap.com/mapui?P=";
	//Build multi-city search based on legs
	for (var i=0;i<data.length;i++) {
		for (var j=0;j<data[i]["seg"].length;j++) {
			url+=data[i]["seg"][j]["orig"]+"-";
			if (j+1<data[i]["seg"].length){
				if (data[i]["seg"][j]["dest"] != data[i]["seg"][(j+1)]["orig"]){url+=data[i]["seg"][j]["dest"]+";"};
			} else {
				url+=data[i]["seg"][j]["dest"]+";"
			}
			
		}
	}
	printUrl(url,"GCM");

}
//ID sidebarNode
function LDLB(deltaURL) {
	var div = document.getElementById('sidebarNode');
	div.innerHTML = div.innerHTML + "<br><br><font size=4><bold><a href=\""+deltaURL+ "&vendorRedirectFlag=true&vendorID=Google" + "\" target=_new>Buy at DL</a></font></bold>";
}
function UALB(uaUrl) {
	var div = document.getElementById('sidebarNode');
	div.innerHTML = div.innerHTML + '<br><br><font size=4><bold><a href=\"https://www.hipmunk.com/bookjs?booking_info=' + encodeURIComponent(uaUrl) + '\" target=_new>Buy at UA</a></font></bold><br>(Copy Link in Text, via HPMNK)';
}
function LORBB(orbitzUrl) {
	var div = document.getElementById('sidebarNode');
	div.innerHTML = div.innerHTML + "<br><br><font size=4><bold><a href=\"http://www.cheaptickets.com"+orbitzUrl + "\" target=_new>Buy at CHPTIX</a></font></bold>";
	div.innerHTML = div.innerHTML + "<br><font size=4><bold><a href=\"http://www.orbitz.com"+orbitzUrl + "\" target=_new>Buy at ORB</a></font></bold>";
}
function USLB(usUrl) {
	var div = document.getElementById('sidebarNode');
	div.innerHTML = div.innerHTML + "<br><br><font size=4><bold><a href=\""+usUrl+ "\" target=_new>Buy at US</a></font></bold><br>(US Only)";
}
function printUrl(url,name,desc="") {
	var div = document.getElementById('sidebarNode');
	div.innerHTML = div.innerHTML + "<br><br><font size=4><bold><a href=\""+url+ "\" target=_new>Open with "+name+"</a></font></bold>"+(desc ? "<br>("+desc+")" : "");
}

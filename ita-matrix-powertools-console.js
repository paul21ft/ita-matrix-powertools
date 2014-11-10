// ==UserScript==
// @name        DL/ORB Itinary Builder
// @namespace   http://matrix.itasoftware.com
// @description Builds fare purchase links
// @version     0.2
// @grant       none
// @include     http://matrix.itasoftware.com/view/details*
// ==/UserScript==

//Version 0.2

//Written by paul21 of FlyerTalk.com
//http://www.flyertalk.com/forum/members/paul21.html
//Copyright Reserved -- At least share with credit if you do

//Simple sleep function
function slp(millis, callback) {
	setTimeout(function()
	{ callback(); }
	, millis);
}

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

//Primary function for extracting flight data from ITA/Matrix
function fePS() {
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

	//Find Airports
	var re=/(strong)*\>[A-Za-z\s/\,\.]*\((\w\w\w)\)[A-Za-z\s/\,\.]*\((\w\w\w)\)/g;
	var airports= new Array();
	var tmp_airports= new Array();
	var legNum = new Array();
	var legAirports = new Array();
	tmp_airports = exRE(itinHTML,re);


	//Find Date
	var re=/(strong)*\>[A-Za-z\s\/\,\.]*\(\w\w\w\)[A-Za-z\s\/\,\.]*\(\w\w\w\)\s*\-\s*\w*\,\s*(\w\w\w)\s([0-9]*)/g;
	var tmp_airdate= new Array();
	var airdate = new Array();
	var legAirdate = new Array();
	tmp_airdate = exRE(itinHTML,re);
	var monthnames=["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP","OCT","NOV","DEC"];


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
	// B5-Coach / B2-Business  on DL
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
	var re=/Carrier\s\w\w\s(\w+)/g;
	var fareBasis=new Array();
	fareBasis=exRE(basisHTML,re);


	var re=/farePrice\"\>\$([0-9,.]+)/g;
	var farePrice = new Array();
	farePrice = exRE(itinHTML,re);

	var re=/Total\scost\sfor\s([0-9])\spassenger/g;
	var numPax = new Array();
	numPax = exRE(itinHTML,re);
		var k=-1;
	var j=0;

	//alert(tmp_airports.join('\n'));
	for(i=0;i<tmp_airports.length;) {
		if (tmp_airports[i] == "strong" ) //Matches the heading airport
		{
			k++;
			legAirports[2*k]=tmp_airports[i+1];
			legAirports[2*k+1]=tmp_airports[i+2];
			legAirdate[2*k]=tmp_airdate[i+1];
			legAirdate[2*k+1]=tmp_airdate[i+2];
			if (tmp_airports.length <= i+3 || tmp_airports[i+3] == "strong") //Single flight in leg
			{
				legNum[j]=k;
				airdate[j]=tmp_airdate[i+1];
				airports[j++]=tmp_airports[i+1];
				legNum[j]=k;
				airdate[j]=tmp_airdate[i+2];
				airports[j++]=tmp_airports[i+2];
				i+=3;
				
			} else //More flights coming up, so ignore the leg ends
			{
				i+=3;
			}
		}  else {
		//Reached a set of two airports in current leg
		legNum[j]=k;
		airdate[j]=tmp_airdate[i+1];
		airports[j++]=tmp_airports[i+1];
		legNum[j]=k;
		airdate[j]=tmp_airdate[i+2];
		airports[j++]=tmp_airports[i+2];
		i+=3;
		}
	}
	
	//Find basis legs
	var re=/Covers ([\w\(\)\s\-,]+)/g;
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
	pricing=pricing.replace(/\,/g,"");
	
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

	var deltaURL ="http://www.delta.com/booking/priceItin.do?dispatchMethod=priceItin&tripType=multiCity&cabin=B5-Coach&currencyCd=USD&exitCountry=US";
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
	var priceval = parseFloat(pricing) + 6.99;
	orbitzUrl += "&userRate.price=USD|" + priceval.toString();

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
	

}



//ID sidebarNode
function LDLB(deltaURL) {
	var div = document.getElementById('sidebarNode');
	div.innerHTML = div.innerHTML + "<br><br><font size=4><bold><a href=\""+deltaURL+ "&vendorRedirectFlag=true&vendorID=Google" + "\" target=_new>Buy at DL</a></font></bold>";
}

function UALB(uaUrl) {
	var div = document.getElementById('sidebarNode');
	div.innerHTML = div.innerHTML + '<br><br><font size=4><bold><a href=\"https://www.hipmunk.com/bookjs?booking_info=' + encodeURIComponent(uaUrl) + '\" target=_new>Buy at UA</a></font></bold><br>(Copy Link in Text, via HPMNK)<br>';
}

function LORBB(orbitzUrl) {
	var div = document.getElementById('sidebarNode');
	div.innerHTML = div.innerHTML + "<br><br><font size=4><bold><a href=\"http://www.cheaptickets.com"+orbitzUrl + "\" target=_new>Buy at CHPTIX</a></font></bold>";
	div.innerHTML = div.innerHTML + "<br><font size=4><bold><a href=\"http://www.orbitz.com"+orbitzUrl + "\" target=_new>Buy at ORB</a></font></bold>";
}

function USLB(usUrl) {
	var div = document.getElementById('sidebarNode');
	div.innerHTML = div.innerHTML + "<br><br><font size=4><bold><a href=\""+usUrl+ "\" target=_new>Buy at US</a></font></bold><br>(US Only)<br>";
}


slp(4000,fePS);


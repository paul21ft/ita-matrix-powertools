// ==UserScript==
// @name DL/ORB Itinary Builder
// @namespace http://matrix.itasoftware.com
// @description Builds fare purchase links
// @version 0.5
// @grant none
// @include http://matrix.itasoftware.com/view/details*
// @include http://matrix.itasoftware.com/view/calendar*
// @include http://matrix.itasoftware.com/search.htm*
// @include http://matrix.itasoftware.com/?*
// @include http://matrix.itasoftware.com/
// ==/UserScript==

/*
 Written by paul21 & Steppo of FlyerTalk.com
 http://www.flyertalk.com/forum/members/paul21.html
 Copyright Reserved -- At least share with credit if you do

*********** Changelog **************
**** Version 0.5 ****
# 2014-11-11 Edited by Steppo (Fixed bug causing close of advanced routing on searchpage,
                                moved extraction and linkgenerating to seperate functions,
                                added a lot of information like flightdurations/codeshare/layovertime/arrival-time-object,
                                complete redesign of data-object, adapted DL/Orbitz/UA/US/Farefreaks/GCM to data-object,
                                added segmentskip to Orbitz && FF if its just a technical stop,
                                removed usage of itaLocal (replaced by itaLanguage ) and default values in function ( thx to kulin for this hints) )
**** Version 0.4 ****
# 2014-11-10 Edited by paul21 (Improved united.com booking support)
# 2014-11-09 Edited by Steppo (Added monthly navigation to calendar,
                                added retry for details if content is loading slow,
                                added flights as object (see data var ),
                                added Farefreaks,
                                added GCM)
**** Version 0.3a ****
# 2014-11-01 Edited by Steppo (shortened some regex,
                               added support for german version of matrix)

*********** About **************
 --- Searchpage ---
  # opens advanced routing by default
 --- Calendar ---
  # makes month-form visible 
  # adding quicklinks to the next/previous months
 --- Resultpage ---
  # collecting a lot of information in data-var
  # based on gathered data-var: creating links to different OTAs and other pages

 *********** Hints ***********
  Unsure about handling of different fares/pax. 
  Unsure about correct usage of cabins while creating links.
  Unsure about correct usage of farebase-per-leg - usage in order of appearance.
  Unsere about segment-skipping - should be fine bud needs heavy testing.
*/
/**************************************** Start Script *****************************************/
// Get language first but do not use itaLocale
var itaLanguage="en";



// global retrycount for setup
var retrycount=1;

// execute language detection and afterwards functions for current page
window.addEventListener('load', function() {  
   setTimeout(function(){getPageLang();}, 100);  
}, false); 

/**************************************** Get Language *****************************************/

function getPageLang(){
    if (document.getElementById("localeSelect_label").innerHTML == "Deutsch") {
    itaLanguage="de";
    retrycount=1;
   } else if (document.getElementById("localeSelect_label").innerHTML == "English") {
    itaLanguage="en";
    retrycount=1;
   } else if (retrycount>=20) {
    //set default and go ahead 
    console.log("Unable to detect language: Falling back to EN"); 
    itaLanguage="en";
    retrycount=1; 
   } else {
    retrycount++; 
    setTimeout(function(){getPageLang();}, 100);
    return false; 
   }
    
    if (window.location.href.indexOf("http://matrix.itasoftware.com/view/calendar") !=-1){
      createmonthlinks();
      setTimeout(function(){makenavigationvisible();}, 200); 
    } else if (window.location.href.indexOf("http://matrix.itasoftware.com/view/details") !=-1) {
       setTimeout(function(){fePS();}, 200);   
    } else if (window.location.href.indexOf("http://matrix.itasoftware.com/search.htm") !=-1 || window.location.href.indexOf("http://matrix.itasoftware.com/?") !=-1 || window.location.href == "http://matrix.itasoftware.com/") {
       setTimeout(function(){buildmain();}, 200);   
    }   
}

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
function monthnameToNumber(month){
  var monthnames=["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP","OCT", "NOV", "DEC"];
  return (monthnames.indexOf(month.toUpperCase())+1);
}
function monthnumberToName(month){
  var monthnames=["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP","OCT", "NOV", "DEC"];
  return (monthnames[month-1]);
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
        if  ((match[3]=='AM' || match[3]=='am') && match[1]=='12'){offset = -12;}
        else if  ((match[3]=='PM' || match[3]=='pm') && match[1]!='12'){ offset = 12;}
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
/******************************************* Search Page *******************************************/
function buildmain(){
    // retry if itin not loaded    
    if (document.getElementById("searchFormsContainer") === undefined) { 
      retrycount++;
      if (retrycount>20) {
        console.log("Error Content not found.");
        return false;
      };

      setTimeout(function(){buildmain();}, 100);   
      return false;
    };
    //open advanced routing fixed toggle-issue in 0.5
    if ( !hasClass(document.getElementById("ita_form_SliceForm_0"),"dijitHidden") 
          && document.getElementById("ita_layout_CollapsiblePane_1").style.display=="none") {
      document.getElementById('sites_matrix_layout_RouteLanguageToggleLink_0').click();
    }
}



/********************************************* Calendar *********************************************/
function makenavigationvisible() {  
  document.getElementById("calendarUpdateForm2").style.display='';
}

function createmonthlinks() {
  linktoimages="http://matrix.itasoftware.com/js/ita/themes/ita/images/";  
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

  document.getElementById('goprevmonth').onclick=function(){changemonth (-1);};
  document.getElementById('gonextmonth').onclick=function(){changemonth (1);};
}


function changemonth (change) {  
if (itaLanguage=="de"){
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
if (date[0]<10 && itaLanguage=="de") {date[0]="0"+date[0]; }
if (date[1]<10 && itaLanguage=="de") {date[1]="0"+date[1]; }
date=date.toString().replace(/,/g, sep); 
document.getElementById('monthSelect').value=date;
document.getElementById('calendarUpdateButton').click();
setTimeout(function(){makenavigationvisible();}, 200);
}

/********************************************* Link Creator *********************************************/
//Primary function for extracting flight data from ITA/Matrix
function fePS() {
    // retry if itin not loaded    
    if (document.getElementById("itineraryNode").innerHTML === "" ) { 
      retrycount++;
      if (retrycount>20) {
        console.log("Error Content not found.");
        return false;
      };
      
      setTimeout(function(){fePS();}, 500);   
      return false;
    };
    
    var data = readItinerary();
    
    printDelta(data);
    
    printOrbitz(data);
    
    printUA(data);
    
    // we print US if its only on US-flights
    if (data["carriers"].length==1 && data["carriers"][0]=="US"){
      printUS(data);
    } 
       
    //*** Farefreaksstuff ****//
    printFarefreaks (data,0);
    printFarefreaks (data,1);
    //*** GCM ****//
    printGCM (data);  
}


  //*** Readfunction ****//
function readItinerary(){
      // the magical part! :-)
      var data= new Array();
      var carrieruarray= new Array();  
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
        if (!inArray(carriers[i],carrieruarray)) {carrieruarray.push(carriers[i]);};
      }  
          
        
      //Currency in EUR?
      var itinCur="";
      var re=/(€)/g;
      var speicher = new Array();
      speicher = exRE(itinHTML,re);
      if (speicher.length>1) itinCur="EUR";
      if (itinCur==""){
          var re=/($)/g;
          var speicher = new Array();
          speicher = exRE(itinHTML,re);
          if (speicher.length>1) itinCur="USD";
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
      tmp_airdate = exRE(itinHTML,re);      
      // lets swap values if german language
      if (itaLanguage=="de"){
        for (var i = 0; i < tmp_airdate.length; i+=3) {
          var speicher=tmp_airdate[i+1];
          tmp_airdate[i+1]=tmp_airdate[i+2].replace(/ä/g, "a").replace(/i/g, "y").replace(/Dez/g, "Dec").replace(/Okt/g, "Oct");
          tmp_airdate[i+2]=speicher;
          }
      }
      
      
      // find information like codeshare layoverduration and timechange on arrival
      var re=/itaGreyText\"\>\s*([^\n]*)\s*\<\/td\>/g;
      var tmp_airarrdate = new Array();
      tmp_airarrdate = exRE(itinHTML,re);
     
      // lets see what we got
      var addinformations = Array();
      for (var i = 0; i < tmp_airarrdate.length; i+=5) {
        var speicher = {codeshare:0, arrdate:"", layoverduration:""};
          // check for codeshare
          if(tmp_airarrdate[i]!="") {speicher["codeshare"]=1;}
          // check timeshift on arrival
          if(tmp_airarrdate[i+2]!="") {
            speicher["arrdate"]={};
            var re=/[^\,]*\,\s*([a-zA-Z0-9]{1,3})\.?\s*([a-zA-Z0-9ä]{1,3})/g;
            var speicher2= new Array();
            speicher2 = exRE(tmp_airarrdate[i+2],re);
            // lets swap values if german language
            if (itaLanguage=="de"){
                var speicher3=speicher2[0];
                speicher2[0]=speicher2[1].replace(/ä/g, "a").replace(/i/g, "y").replace(/Dez/g, "Dec").replace(/Okt/g, "Oct");
                speicher2[1]=speicher3;
            }
           speicher["arrdate"]["day"]=parseInt(speicher2[1]);
           speicher["arrdate"]["month"]=monthnameToNumber(speicher2[0]);
           speicher["arrdate"]["year"]=getFlightYear(speicher["arrdate"]["day"],speicher["arrdate"]["month"]);
            
          }
          if(tmp_airarrdate[i+3]!="") {
            var re=/([0-9]{1,2})/g;
            var speicher2 = new Array();
            speicher2 = exRE(tmp_airarrdate[i+3],re);
            speicher["layoverduration"]=parseInt(speicher2[0])*60 + parseInt(speicher2[1]);
          }
          addinformations.push(speicher);
       }
      
      /* introduced in 0.5 */
      //console.log(addinformations);
      
      //Find times
      var re=/dijitReset departure\"\>[^0-9]+(.*?)\<\/td\>/g;
      var deptimes= new Array();
      deptimes = exRE(itinHTML,re);
      
      var re=/dijitReset arrival\"\>[^0-9]+(.*?)\<\/td\>/g;
      var arrtimes= new Array();
      arrtimes = exRE(itinHTML,re);
      if (itaLanguage!="de"){
      // take care of 12h
        for (var i = 0; i < deptimes.length; i++) {
          deptimes[i]=return12htime(deptimes[i]);
          arrtimes[i]=return12htime(arrtimes[i]);
        }
      }
      
      // find flightduration
      var re=/dijitReset duration\"\>([^\<]*)\<\/td\>/g;
      var durations= new Array();
      durations = exRE(itinHTML,re);
      for (var i=0; i<durations.length;i++){
        var re=/([0-9]{1,2})/g;
        var speicher = new Array();
        speicher = exRE(durations[i],re);
        durations[i]=parseInt(speicher[0])*60 + parseInt(speicher[1]);         
        
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
      //end new code
      }
      
      //Find Book Class
      var re = /\((\w)\)/g;
      var bookclass = new Array();
      bookclass = exRE(itinHTML,re);
      //Find Class of Service
      var re = /(\w)[\w]+\&nbsp\;\(\w\)/g;
      var classofservice = new Array();
      classofservice = exRE(itinHTML,re);
      
      
      // Find fare-price
      var re=/farePrice\"\>[^0-9]*([0-9,.]+)/g;
      var farePrice = new Array();
      farePrice = exRE(itinHTML,re);
      //total price will be the last one
      farePrice=farePrice[(farePrice.length-1)];
      if (itaLanguage=="de"){
      farePrice=farePrice.replace(/\./g,"").replace(/\,/g,".");
      } else {
      farePrice=farePrice.replace(/\,/g,"");
      }
      
      // Get the number of Pax
      if (itaLanguage=="de"){
      var re=/Gesamtpreis\sfür\s([0-9])\sPassagier/g;
      } else {
      var re=/Total\scost\sfor\s([0-9])\spassenger/g;
      }
      var numPax = new Array();
      numPax = exRE(itinHTML,re);
      
      
      //Find leg divider
      var basisHTML = document.getElementById("ita_layout_RoundedPane_1").innerHTML;
      //find farecodes
      if (itaLanguage=="de"){
      var re=/Airline\s\w\w\s(\w+)\s[\w{3}]/g;
      } else {
      var re=/Carrier\s\w\w\s(\w+)\s[\w{3}]/g;
      }
      var fareBasis=new Array();
      fareBasis=exRE(basisHTML,re);
      
      //Find basis legs  => NEW
      if (itaLanguage=="de"){
      var re=/Strecke\(n\) ([\w\(\)\s\-,]+)/g;
      } else {
      var re=/Covers ([\w\(\)\s\-,]+)/g;
      }
      var fareBaseLegs = { fares :new Array(), legs:new Array()};
      fareBaseLegs["fares"]= exRE(basisHTML,re);
      var re=/(\w\w\w\-\w\w\w)/g;
      // find the covered airports
      for (i=0;i<fareBaseLegs["fares"].length;i++) {
       fareBaseLegs["legs"].push(exRE(fareBaseLegs["fares"][i],re));
      }
      fareBaseLegs["fares"]=fareBasis;
      // We have an object now in which fares[i] covers coutes[i]
      // console.log(fareBaseLegs)
      
      var dirtyFare= new Array();  
      // dirty but handy for later usage since there is no each function
      for(var i=0;i<fareBaseLegs["legs"].length;i++) {
        for(var j=0;j<fareBaseLegs["legs"][i].length;j++) {
         dirtyFare.push(fareBaseLegs["legs"][i][j]+"-"+fareBaseLegs["fares"][i]);
        }
      }
      
      var k=-1;
      var datapointer=0;  
      var legobj={};
      // lets try to build an structured object
      for(i=0;i<tmp_airports.length;i+=3) {
            if (tmp_airports[i] == "strong" ) //Matches the heading airport
            {
                if (k>=0) {data.push(legobj);}
                k++;
                legobj={};
                //lets build the outer structure
                legobj["orig"]=tmp_airports[i+1];
                legobj["dest"]=tmp_airports[i+2];
                legobj["dep"]={};
                legobj["arr"]={};
                legobj["dep"]["day"]=parseInt(tmp_airdate[i+2]);
                legobj["dep"]["month"]=monthnameToNumber(tmp_airdate[i+1]);
                legobj["dep"]["year"]=getFlightYear(legobj["dep"]["day"],legobj["dep"]["month"]);
                legobj["dep"]["time"] = deptimes[datapointer];
                legobj["seg"] = new Array();
                if (tmp_airports.length <= i+3 || tmp_airports[i+3] == "strong") //Single flight in leg
                {                       
                    speicher={};
                    speicher["orig"]=tmp_airports[i+1];
                    speicher["dest"]=tmp_airports[i+2];
                    speicher["dep"]={};
                    speicher["dep"]["day"]=parseInt(tmp_airdate[i+2]);
                    speicher["dep"]["month"]=monthnameToNumber(tmp_airdate[i+1]);
                    speicher["dep"]["year"]=getFlightYear(speicher["dep"]["day"],speicher["dep"]["month"]);
                    speicher["dep"]["time"]=deptimes[datapointer];
                    speicher["arr"]={};
                    if (addinformations[datapointer]["arrdate"]!=""){
                      speicher["arr"]["day"]=addinformations[datapointer]["arrdate"]["day"];
                      speicher["arr"]["month"]=addinformations[datapointer]["arrdate"]["month"];
                      speicher["arr"]["year"]=addinformations[datapointer]["arrdate"]["year"];                     
                    } else {
                      speicher["arr"]["day"]=speicher["dep"]["day"];
                      speicher["arr"]["month"]=speicher["dep"]["month"];
                      speicher["arr"]["year"]=speicher["dep"]["year"];                    
                    }
                    speicher["arr"]["time"]=arrtimes[datapointer];
                    legobj["arr"]["day"]=speicher["arr"]["day"];
                    legobj["arr"]["month"]=speicher["arr"]["month"];
                    legobj["arr"]["year"]=speicher["arr"]["year"];
                    legobj["arr"]["time"]=speicher["arr"]["time"];
                    speicher["codeshare"]=addinformations[datapointer]["codeshare"];
                    speicher["layoverduration"]=addinformations[datapointer]["layoverduration"];    
                    speicher["duration"]=durations[datapointer];
                    speicher["carrier"]=carriers[datapointer];
                    speicher["bookingclass"]=bookclass[datapointer];
                    speicher["fnr"]=flightnums[datapointer][0];
                    speicher["cabin"]=getcabincode(classofservice[datapointer]);
                    // find farecode for leg
                    for(var j=0;j<dirtyFare.length;j++) {
                         if (dirtyFare[j].indexOf(speicher["orig"]+"-"+speicher["dest"]+"-")!= -1) {
                          //found farebase of this segment
                           speicher["farebase"]=dirtyFare[j].replace(speicher["orig"]+"-"+speicher["dest"]+"-","");
                           dirtyFare[j]=speicher["farebase"]; // avoid reuse
                           j=dirtyFare.length;
                         }
                    }
                    legobj["seg"].push(speicher);
                    datapointer++;
                }
            } else {
                speicher={};
                speicher["orig"]=tmp_airports[i+1];
                speicher["dest"]=tmp_airports[i+2];
                speicher["dep"]={};
                speicher["dep"]["day"]=parseInt(tmp_airdate[i+2]);
                speicher["dep"]["month"]=monthnameToNumber(tmp_airdate[i+1]);
                speicher["dep"]["year"]=getFlightYear(speicher["dep"]["day"],speicher["dep"]["month"]);
                speicher["dep"]["time"]=deptimes[datapointer];
                speicher["arr"]={};
                if (addinformations[datapointer]["arrdate"]!=""){
                  speicher["arr"]["day"]=addinformations[datapointer]["arrdate"]["day"];
                  speicher["arr"]["month"]=addinformations[datapointer]["arrdate"]["month"];
                  speicher["arr"]["year"]=addinformations[datapointer]["arrdate"]["year"];                     
                 } else {
                  speicher["arr"]["day"]=speicher["dep"]["day"];
                  speicher["arr"]["month"]=speicher["dep"]["month"];
                  speicher["arr"]["year"]=speicher["dep"]["year"];                    
                 }
                speicher["arr"]["time"]=arrtimes[datapointer];
                legobj["arr"]["day"]=speicher["arr"]["day"];
                legobj["arr"]["month"]=speicher["arr"]["month"];
                legobj["arr"]["year"]=speicher["arr"]["year"];
                legobj["arr"]["time"]=speicher["arr"]["time"];
                speicher["codeshare"]=addinformations[datapointer]["codeshare"];
                speicher["layoverduration"]=addinformations[datapointer]["layoverduration"];    
                speicher["duration"]=durations[datapointer];
                speicher["carrier"]=carriers[datapointer];
                speicher["bookingclass"]=bookclass[datapointer];
                speicher["fnr"]=flightnums[datapointer][0];
                speicher["cabin"]=getcabincode(classofservice[datapointer]);
                // find farecode for leg
                for(var j=0;j<dirtyFare.length;j++) {
                    if (dirtyFare[j].indexOf(speicher["orig"]+"-"+speicher["dest"]+"-")!= -1) {
                     //found farebase of this segment
                      speicher["farebase"]=dirtyFare[j].replace(speicher["orig"]+"-"+speicher["dest"]+"-","");
                      dirtyFare[j]=speicher["farebase"]; // avoid reuse
                      j=dirtyFare.length;
                    }
                 }
                legobj["seg"].push(speicher);
                datapointer++;      
            }
      }
      data.push(legobj); // push of last leg
      // add price and pax
      // a little bit unsure about multiple pax with different farebase
      data={itin:data, price: farePrice, numPax:numPax[0] , carriers:carrieruarray, cur : itinCur, farebases:fareBaseLegs["fares"]};
          
      //console.log(data); //Remove to see flightstructure
      return data;
}  
  //*** Printfunctions ****//
function getDeltaCabin(cabin){
// 0 = Economy; 1=Premium Economy; 2=Business; 3=First
// // B5-Coach / B2-Business on DL
  switch(cabin) {
      case 2:
          cabin="B2-Business";
          break;
      case 3:
          cabin="B2-Business";
          break;
      default:
          cabin="B5-Coach";
  }
  return cabin;
}  
  
function printDelta(data){
// Steppo: Cabincodefunction needs some care!?
// Steppo: What about farebasis?
// Steppo: What about segmentskipping?
    var deltaURL ="http://"+(itaLanguage=="de" ? "de" : "www");
    deltaURL +=".delta.com/booking/priceItin.do?dispatchMethod=priceItin&tripType=multiCity&cabin=B5-Coach";
    deltaURL +="&currencyCd=" + (data["cur"]=="EUR" ? "EUR" : "USD") + "&exitCountry=US";
    var segcounter=0;
    for (var i=0;i<data["itin"].length;i++) {
      // walks each leg
       for (var j=0;j<data["itin"][i]["seg"].length;j++) {
         //walks each segment of leg
        deltaURL +="&itinSegment["+segcounter.toString()+"]="+i.toString()+":"+data["itin"][i]["seg"][j]["bookingclass"];
        deltaURL +=":"+data["itin"][i]["seg"][j]["orig"]+":"+data["itin"][i]["seg"][j]["dest"]+":"+data["itin"][i]["seg"][j]["carrier"]+":"+data["itin"][i]["seg"][j]["fnr"];
        deltaURL +=":"+monthnumberToName(data["itin"][i]["seg"][j]["dep"]["month"])+":"+ ( data["itin"][i]["seg"][j]["dep"]["day"] < 10 ? "0":"") +data["itin"][i]["seg"][j]["dep"]["day"]+":"+data["itin"][i]["seg"][j]["dep"]["year"]+":0";
        segcounter++; 
      }
    }
    deltaURL += "&fareBasis="+data["farebases"].toString().replace(/,/g, ":");
    deltaURL += "&price="+data["price"];
    deltaURL += "&numOfSegments=" + segcounter.toString() + "&paxCount=" + data["numPax"];
    deltaURL += "&vendorRedirectFlag=true&vendorID=Google";  
    printUrl(deltaURL,"DL","");
}

function getOrbitzCabin(cabin){
// 0 = Economy; 1=Premium Economy; 2=Business; 3=First
// C - Coach / B - Business / F - First on ORB
  switch(cabin) {
      case 2:
          cabin="B";
          break;
      case 3:
          cabin="F";
          break;
      default:
          cabin="C";
  }
  return cabin;
}

function printOrbitz(data){
    // Steppo: This should be fine
    var selectKey="";
    var orbitzUrl = "/shop/home?type=air&source=GOOGLE_META&searchHost=ITA&ar.type=multiCity&strm=true";
    //Build multi-city search based on legs
    for (var i=0;i<data["itin"].length;i++) {
      // walks each leg
            var iStr = i.toString();
            orbitzUrl += "&ar.mc.slc["+iStr+"].orig.key=" + data["itin"][i]["orig"];
            orbitzUrl += "&_ar.mc.slc["+iStr+"].originRadius=0";
            orbitzUrl += "&ar.mc.slc["+iStr+"].dest.key=" + data["itin"][i]["dest"];
            orbitzUrl += "&_ar.mc.slc["+iStr+"].destinationRadius=0";
            var twoyear = data["itin"][i]["dep"]["year"]%100;
            orbitzUrl += "&ar.mc.slc["+iStr+"].date=" + data["itin"][i]["dep"]["month"].toString() + "/" + data["itin"][i]["dep"]["day"].toString() + "/" + twoyear.toString();
            orbitzUrl += "&ar.mc.slc["+iStr+"].time=Anytime";      
       for (var j=0;j<data["itin"][i]["seg"].length;j++) {
         //walks each segment of leg
                var k=0;
                // lets have a look if we need to skip segments - Flightnumber has to be the same and it must be just a layover
                while ((j+k)<data["itin"][i]["seg"].length-1){
                 if (data["itin"][i]["seg"][j+k]["fnr"] != data["itin"][i]["seg"][j+k+1]["fnr"] || 
                     data["itin"][i]["seg"][j+k]["layoverduration"] >= 1440) break;
                 k++;
                }               
                selectKey += data["itin"][i]["seg"][j]["carrier"] + data["itin"][i]["seg"][j]["fnr"] + data["itin"][i]["seg"][j]["orig"] + data["itin"][i]["seg"][j+k]["dest"] + ( data["itin"][i]["seg"][j]["dep"]["month"] < 10 ? "0":"") + data["itin"][i]["seg"][j]["dep"]["month"] +  ( data["itin"][i]["seg"][j]["dep"]["day"] < 10 ? "0":"") + data["itin"][i]["seg"][j]["dep"]["day"] + getOrbitzCabin(data["itin"][i]["seg"][j]["cabin"]);
                selectKey += "_";                      
                j+=k;
      }
    }
    
    orbitzUrl += "&ar.mc.numAdult=" + data["numPax"];
    orbitzUrl += "&ar.mc.numSenior=0&ar.mc.numChild=0&ar.mc.child[0]=&ar.mc.child[1]=&ar.mc.child[2]=&ar.mc.child[3]=&ar.mc.child[4]=&ar.mc.child[5]=&ar.mc.child[6]=&ar.mc.child[7]=&search=Search Flights&ar.mc.nonStop=true&_ar.mc.nonStop=0";
    //lets see if we can narrow the carriers  Orbitz supports up to 3
    if (data["carriers"].length <= 3) {
      orbitzUrl += "&_ar.mc.narrowSel=1&ar.mc.narrow=airlines";
      for (var i = 0; i< 3;i++){
          if (i<data["carriers"].length){
          orbitzUrl += "&ar.mc.carriers["+i+"]="+data["carriers"][i];
          } else {
          orbitzUrl += "&ar.mc.carriers["+i+"]=";
          }       
      }
    } else {
      orbitzUrl += "&_ar.mc.narrowSel=0&ar.mc.narrow=airlines&ar.mc.carriers[0]=&ar.mc.carriers[1]=&ar.mc.carriers[2]=";
    }   
    orbitzUrl += "&ar.mc.cabin=C";
    orbitzUrl += "&selectKey=" + selectKey.substring(0,selectKey.length-1);;
    if (data["cur"]=="USD") {
    //lets do this when USD is cur
    var priceval = parseFloat(pricing) + 6.99;
    orbitzUrl += "&userRate.price=USD|" + priceval.toString();
    }
    printUrl("http://www.cheaptickets.com"+orbitzUrl,"CHPTIX","");
    printUrl("http://www.orbitz.com"+orbitzUrl,"ORB","");
    
}

function getUACabin(cabin){
// 0 = Economy; 1=Premium Economy; 2=Business; 3=First
// Coach - Coach / Business - Business / First - First on UA
  switch(cabin) {
      case 2:
          cabin="Business";
          break;
      case 3:
          cabin="First";
          break;
      default:
          cabin="Coach";
  }
  return cabin;
}



function printUA(data){
var uaUrl='{\"post\": {\"pax\": '+data["numPax"];
uaUrl += ', \"trips\": [';
    for (var i=0;i<data["itin"].length;i++) {
      var minCabin=3;
      uaUrl += '{\"origin\": \"'+data["itin"][i]["orig"]+'\", \"dest\": \"'+data["itin"][i]["dest"]+'\", \"dep_date\": \"'+data["itin"][i]["dep"]["month"]+'/'+data["itin"][i]["dep"]["day"]+'/'+data["itin"][i]["dep"]["year"]+'\", \"segments\": [';
      // walks each leg
       for (var j=0;j<data["itin"][i]["seg"].length;j++) {
         //walks each segment of leg
          var k = 0;
         // lets have a look if we need to skip segments - Flightnumber has to be the same and it must be just a layover
          while ((j+k)<data["itin"][i]["seg"].length-1){
          if (data["itin"][i]["seg"][j+k]["fnr"] != data["itin"][i]["seg"][j+k+1]["fnr"] || 
                   data["itin"][i]["seg"][j+k]["layoverduration"] >= 1440) break;
                 k++;
          }
          uaUrl += '{\"origin\": \"'+data["itin"][i]["seg"][j]["orig"]+'\", \"dep_date\": \"'+ data["itin"][i]["seg"][j]["dep"]["month"].toString() +'/'+ data["itin"][i]["seg"][j]["dep"]["day"].toString() +'/'+data["itin"][i]["seg"][j]["dep"]["year"].toString() +'\", \"dest_date\": \" \", \"dest\": \"'+data["itin"][i]["seg"][j+k]["dest"]+'\", ';
          uaUrl += '\"flight_num\": '+data["itin"][i]["seg"][j]["fnr"]+', \"carrier\": \"'+data["itin"][i]["seg"][j]["carrier"]+'\", \"fare_code\": \"'+data["itin"][i]["seg"][j]["farebase"]+'\"},';         
          if (data["itin"][i]["seg"][j]["cabin"] < minCabin) {minCabin=data["itin"][i]["seg"][j]["cabin"];};
          j+=k; 
      }
      uaUrl = uaUrl.substring(0,uaUrl.length-1)+'],\"cabin\": \"'+getUACabin(minCabin)+'\"},';
    }
    uaUrl = 'https://www.hipmunk.com/bookjs?booking_info=' + encodeURIComponent(uaUrl.substring(0,uaUrl.length-1) +']}, \"kind\": \"flight\", \"provider_code\": \"UA\" }');
    printUrl(uaUrl,"UA","Copy Link in Text, via HPMNK");
}

function getUSCabin(cabin){
  // 0 = Economy; 1=Premium Economy; 2=Business; 3=First
  switch(cabin) {
      case 2:
          cabin="B";
          break;
      case 3:
          cabin="F";
          break;
      default:
          cabin="C";
  }
  return cabin;
}
function printUS(data){
// Steppo: is class of service implemented correct?
// Steppo: legskipping necessary?

    var usUrl = "https://shopping.usairways.com/Flights/Passenger.aspx?g=goo&c=goog_US_pax";
    usUrl += "&a=" + data["numPax"];
    usUrl += "&s=" + getUSCabin(data["itin"][0]["seg"][0]["cabin"]).toLowerCase();

    for (var i=0;i<data["itin"].length;i++) {
      // walks each leg
       for (var j=0;j<data["itin"][i]["seg"].length;j++) {
         //walks each segment of leg
        var segstr = (i+1).toString()+(j+1).toString();
        usUrl += "&o"+segstr+"=" + data["itin"][i]["seg"][j]["orig"] + "&d"+segstr+"=" + data["itin"][i]["seg"][j]["dest"] + "&f"+segstr+"=" + data["itin"][i]["seg"][j]["fnr"];
        usUrl += "&t"+segstr+"=" + data["itin"][i]["seg"][j]["dep"]["year"] + (data["itin"][i]["seg"][j]["dep"]["month"] < 10 ? "0":"" )+ data["itin"][i]["seg"][j]["dep"]["month"] +(data["itin"][i]["seg"][j]["dep"]["day"] < 10 ? "0":"" ) + data["itin"][i]["seg"][j]["dep"]["day"] + "0000";
        usUrl += "&x"+segstr+"=" + data["itin"][i]["seg"][j]["farebase"];
      }
    }
    printUrl(usUrl,"US","");
}

function printFarefreaks (data,method){
// Should be fine
// method: 0 = based on leg; 1 = based on segment
    var carrieruarray = new Array();
    var mincabin=3;
    var segsize=0;  
    var farefreaksurl = "https://www.farefreaks.com/landing/landing.php?";
    if (itaLanguage=="de"){
    farefreaksurl +="lang=de";
    } else {
    farefreaksurl +="lang=us";
    }
    farefreaksurl += "&target=flightsearch&referrer=matrix";
    for (var i=0;i<data["itin"].length;i++) {
        if (method!=1){
          farefreaksurl += "&orig["+segsize+"]=" + data["itin"][i]["orig"];
          farefreaksurl += "&dest["+segsize+"]=" + data["itin"][i]["dest"];
          farefreaksurl += "&date["+segsize+"]="+data["itin"][i]["dep"]["year"].toString() + "-" + data["itin"][i]["dep"]["month"] + "-" + data["itin"][i]["dep"]["day"] + "_"+data["itin"][i]["dep"]["time"]+":00";
          farefreaksurl += "&validtime["+segsize+"]=1";
          segsize++; 
        } 
       for (var j=0;j<data["itin"][i]["seg"].length;j++) {
        if (method==1){
          var k=0;
          // lets have a look if we need to skip segments - Flightnumber has to be the same and it must be just a layover
          while ((j+k)<data["itin"][i]["seg"].length-1){
          if (data["itin"][i]["seg"][j+k]["fnr"] != data["itin"][i]["seg"][j+k+1]["fnr"] || 
                   data["itin"][i]["seg"][j+k]["layoverduration"] >= 1440) break;
                 k++;
          }
          farefreaksurl += "&orig["+segsize+"]=" + data["itin"][i]["seg"][j]["orig"];
          farefreaksurl += "&dest["+segsize+"]=" + data["itin"][i]["seg"][j+k]["dest"];
          farefreaksurl += "&date["+segsize+"]="+data["itin"][i]["seg"][j]["dep"]["year"].toString() + "-" + data["itin"][i]["seg"][j]["dep"]["month"] + "-" + data["itin"][i]["seg"][j]["dep"]["day"] + "_"+data["itin"][i]["seg"][j]["dep"]["time"]+":00";
          farefreaksurl += "&validtime["+segsize+"]=1";
          segsize++;
          j+=k;  
        }         
        if (data["itin"][i]["seg"][j]["cabin"]<mincabin){mincabin=data["itin"][i]["seg"][j]["cabin"];};  
        if (!inArray(data["itin"][i]["seg"][j]["carrier"],carrieruarray)){carrieruarray.push(data["itin"][i]["seg"][j]["carrier"]);};  
      }
    }
    farefreaksurl += "&adult="+data["numPax"];  
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
    if (segsize<=6) {printUrl(farefreaksurl,"FF",desc);};
}

function printGCM (data){
    var url = "http://www.gcmap.com/mapui?P=";
    // Build multi-city search based on segments
    // Keeping continous path as long as possible 
    for (var i=0;i<data["itin"].length;i++) {
      for (var j=0;j<data["itin"][i]["seg"].length;j++) {
        url+=data["itin"][i]["seg"][j]["orig"]+"-";
        if (j+1<data["itin"][i]["seg"].length){
          if (data["itin"][i]["seg"][j]["dest"] != data["itin"][i]["seg"][(j+1)]["orig"]){url+=data["itin"][i]["seg"][j]["dest"]+";";};
        } else {
         url+=data["itin"][i]["seg"][j]["dest"]+";";
        }    
      }
    }
 printUrl(url,"GCM","");
}
//ID sidebarNode
function printUrl(url,name,desc) {
var div = document.getElementById('sidebarNode');
div.innerHTML = div.innerHTML + "<br><br><font size=4><bold><a href=\""+url+ "\" target=_blank>Open with "+name+"</a></font></bold>"+(desc ? "<br>("+desc+")" : "");
}

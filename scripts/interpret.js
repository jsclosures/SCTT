function(commandLine){
    console.log("command",commandLine);
  function getOffset( el ) {
      //var rect = el.getBoundingClientRect();
      //let rect = getCurrentContext().domGeom.position(el);
      let rect = dojo.coords(el);
      console.log(rect);
      return {
          left: rect.l,
          top: rect.t,
          width: rect.w,
          height: rect.h
      };
  }
  
  function getSectionTitle(allData,source,aList){
      let sourceValue = allData[source].source;
      let sourceKey = source;
  
      if( aList && aList.length > 0 ){
         sourceKey = aList[0].id.indexOf("BEFORE") > -1 ? "B" : "A";
      }
      let result = "<b>" + sourceKey + "</B>: " + sourceValue;
      result = result.replaceAll(",","-");
  
      return( result );
  }
  
  function connectWithLine(div1, div2, color, thickness) { // draw a line connecting elements
      var off1 = getOffset(div1);
      var off2 = getOffset(div2);
      console.log("build line",off1,off2);
      
      // bottom right
      var x1 = off1.left;// + Math.round(off1.width/2);
      var y1 = off1.top + 10;
      // top right
      var x2 = off2.left - 20;
      var y2 = off2.top + 10;
      // distance
      var length = Math.sqrt(((x2-x1) * (x2-x1)) + ((y2-y1) * (y2-y1)));
      // center
      var cx = ((x1 + x2) / 2) - (length / 2);
      var cy = ((y1 + y2) / 2) - (thickness / 2);
      // angle
      var angle = Math.atan2((y1-y2),(x1-x2))*(180/Math.PI);
      // make hr
      //var htmlLine = "<div style='padding:0px; margin:0px; height:" + thickness + "px; background-color:" + color + "; line-height:1px; position:absolute; left:" + cx + "px; top:" + cy + "px; width:" + length + "px; -moz-transform:rotate(" + angle + "deg); -webkit-transform:rotate(" + angle + "deg); -o-transform:rotate(" + angle + "deg); -ms-transform:rotate(" + angle + "deg); transform:rotate(" + angle + "deg);' />";
      //
      // alert(htmlLine);
      //container.innerHTML += htmlLine;
      let result = WIDGETFACTORY.buildWidget({which:"div",style: {"padding": "0px",
                                                                  "margin": "0px",
                                                                  "height": thickness + "px",
                                                                  "background-color": color,
                                                                  "line-height": "1px",
                                                                  "position": "absolute",
                                                                  "left": cx + "px",
                                                                  "top": cy + "px",
                                                                  "width": length + "px",
                                                                  "-moz-transform": "rotate(" + angle + "deg)",
                                                                  "-webkit-transform": "rotate(" + angle + "deg)",
                                                                  "-o-transform": "rotate(" + angle + "deg)",
                                                                  "-ms-transform": "rotate(" + angle + "deg)",
                                                                  "transform": "rotate(" + angle + "deg)"}});
      console.log("new widget",result);
      return( result );
  }
  var profileManager = getCurrentContext().UIProfileManager;
              
                  let searchBox = this.searchBox;
                  let messageBox = this.messageBox;
                  let resultPanelA = this.resultPanelA;
                  let resultPanelB = this.resultPanelB;
                  let test = this.test;
                  
                  let allData = {};
                  
                  function findMatch(rec,key1,key2,otherList){
                      var result = -1;
                      for(var i = 0;i < otherList.length;i++){
                          if( (rec[key1] && rec[key1] === otherList[i][key1]) || (rec[key2] && rec[key2] === otherList[i][key2]) ){
                              result = i;
                              break;
                          }
                      }
                  
                      return( result );
                  }
  
                  function indexOf(str,otherList){
                      let result = -1;
                      if( otherList ){
                      for(var i = 0;i < otherList.length;i++){
                          if( str == otherList[i] ){
                              result = i;
                              break;
                          }
                      }
                      }
                      console.log("checking index",result,str,otherList);
                      
                      return( result );
                  }
                  
                  let callback = function(args,resp){
                      console.log(resp);
                      let resultPanelA = this.resultPanelA;
                      let resultPanelB = this.resultPanelB;
                      let input = this.input;
                      let sourceA = "A";
                      let sourceB = "B";
                      let channel = this.channel;
                      let masterContainer = this.parent;
                      
                      WIDGETFACTORY.clearChildren({widget: resultPanelA});
                      WIDGETFACTORY.clearChildren({widget: resultPanelB});
                      
                      let docs = resp.items;
                      
                      if( docs.length > 0 ){
                          allData[sourceA] = {docs: [docs[0]],resultPanel: resultPanelA,source: sourceA,channel: channel};
                          allData[sourceA].source = docs[0].source;
                      }
                      else {
                          allData[sourceA] = {docs: [],resultPanel: resultPanelA,source: sourceA,channel: channel};
                      }
                      
                      if( docs.length > 1){
                          allData[sourceB] = {docs: [docs[1]],resultPanel: resultPanelB,source: sourceB,channel: channel};
                          allData[sourceB].source = docs[1].source;
                      }
                      else {
                          allData[sourceB] = {docs: [],resultPanel: resultPanelB,source: sourceB,channel: channel};
                      }
                      
                      let done = 0;
  
                      for(var p in allData){
                          if( allData.hasOwnProperty(p) )
                              done++;
                      }
                      
                      if( done == 2 ){
                          let sList = [sourceA,sourceB];
                          let aList = allData[sourceA].docs;
                          let bList = allData[sourceB].docs;
                          
                          let leftColor = "green";
                          let rightColor = "green";
                          let aDocWidget;
                          let bDocWidget;
                          
                          for(let i in aList){
                          console.log("index",i);
                                  
                              if( i == 0 ){
                                  aDocWidget = WIDGETFACTORY.buildWidget({which:"div",innerHTML: getSectionTitle(allData,sourceA,aList) });
                                  console.log("adoc",aDocWidget);
                                  WIDGETFACTORY.addWidgetToContainer({parent: allData[sourceA].resultPanel,child: aDocWidget});
                                  
                                  bDocWidget = WIDGETFACTORY.buildWidget({which:"div",innerHTML: getSectionTitle(allData,sourceB,bList) });
                                  
                                  WIDGETFACTORY.addWidgetToContainer({parent: allData[sourceB].resultPanel,child: bDocWidget});
                              }
                              
                              var matchIndex = findMatch(aList[i],"id","topdoc",bList);
                              
                              if( matchIndex > -1 ){
                                  if(  matchIndex != i ){
                                      if( matchIndex < i ){
                                          leftColor = "red";
                                          rightColor = "red";
                                      }
                                      else {
                                          leftColor = "green";
                                          rightColor = "green";
                                      }
                                  }
                                  else {
                                      leftColor = "green";
                                      rightColor = "green";
                                  }
                              }
                              else {
                                  leftColor = "yellow";
                                  rightColor = "yellow";
                              }
                                  
                              
                              let entryWidgetA = WIDGETFACTORY.buildWidget({which:"ul",innerHTML: "Document " + i,style: {"background-color": leftColor}});
                              WIDGETFACTORY.addHandler({widget: entryWidgetA,handler: [{name: "click",callback: handleClick.bind({doc: aList[i],input: input})}]});
                                  
                              for(let a in aList[i]){
                                  if( !a.startsWith("_") && ["id","score","qtime","rowcount","topdoc","query_txt"].indexOf(a) > -1 ){
                                      if( a == 'topdoc' ){
                                          let dList = aList[i]["topdoc"];
                                          let attributeWidget = WIDGETFACTORY.buildWidget({which:"li",innerHTML: a + ": "});
                                          WIDGETFACTORY.addWidgetToContainer({parent: entryWidgetA,child: attributeWidget});
  
                                          if( dList ){
                                              aList[i]["_topdocwidget"] = [];
                                              let docListWidget = WIDGETFACTORY.buildWidget({which:"ul",style: {"background-color": leftColor}});
                                              WIDGETFACTORY.addWidgetToContainer({parent: entryWidgetA,child: docListWidget});
                                              dList = dList.split("~");
                                              aList[i]["_topdoc"] = dList;
                                              for(let di in dList){
                                                  let docItemWidget = WIDGETFACTORY.buildWidget({which:"li",innerHTML: dList[di]});
                                                  WIDGETFACTORY.addWidgetToContainer({parent: docListWidget,child: docItemWidget});
                                                  aList[i]["_topdocwidget"].push(docItemWidget);
                                              }
                                          }
                                      }
                                      else{
                                          let attributeWidget = WIDGETFACTORY.buildWidget({which:"li",innerHTML: a + ": " + aList[i][a]});
                                          WIDGETFACTORY.addWidgetToContainer({parent: entryWidgetA,child: attributeWidget});
                                      }
                                  }
                              }
                              WIDGETFACTORY.addWidgetToContainer({parent: aDocWidget,child: entryWidgetA});
                              
                              if( i < bList.length ){
                                  let entryWidgetB = WIDGETFACTORY.buildWidget({which:"ul",innerHTML: "Document " + i,style: {"background-color": rightColor}});
                                  WIDGETFACTORY.addHandler({widget: entryWidgetB,handler: [{name: "click",callback: handleClick.bind({doc: bList[i],input: input})}]});
                                  WIDGETFACTORY.addWidgetToContainer({parent: bDocWidget,child: entryWidgetB});        
                                  for(let a in bList[i]){
                                      if( !a.startsWith("_") && ["id","score","qtime","rowcount","topdoc","query_txt"].indexOf(a) > -1 ){
                                          if( a == 'topdoc' ){
                                          let dList = bList[i]["topdoc"];
                                          let attributeWidget = WIDGETFACTORY.buildWidget({which:"li",innerHTML: a + ": "});
                                          WIDGETFACTORY.addWidgetToContainer({parent: entryWidgetB,child: attributeWidget});
  
                                          if( dList ){
                                              let docListWidget = WIDGETFACTORY.buildWidget({which:"ul",style: {"background-color": rightColor}});
                                              WIDGETFACTORY.addWidgetToContainer({parent: entryWidgetB,child: docListWidget});
                                              dList = dList.split("~");
                                              bList[i]["_topdoc"] = dList;
                                              bList[i]["_topdocwidget"] = [];
                                              for(let di in dList){
                                                  let docItemWidget = WIDGETFACTORY.buildWidget({which:"li",innerHTML: dList[di]});
                                                  WIDGETFACTORY.addWidgetToContainer({parent: docListWidget,child: docItemWidget});
                                                  bList[i]["_topdocwidget"].push(docItemWidget);
                                                  let docMatchIndex = indexOf(dList[di],aList[i]["_topdoc"]);
                              
                          if( docMatchIndex> -1 && aList[i]["_topdocwidget"][docMatchIndex] ){
                                                      let line = connectWithLine(aList[i]["_topdocwidget"][docMatchIndex], docItemWidget, "#f00", "1");
                                                      console.log("draw line",docMatchIndex);
                                                      WIDGETFACTORY.addWidgetToContainer({parent: resultPanelA ,child: line});
                                                  }
                                              }
                                          }
                                      }
                                      else{
                                              let attributeWidget = WIDGETFACTORY.buildWidget({which:"li",innerHTML: a + ": " + bList[i][a]});
                                              WIDGETFACTORY.addWidgetToContainer({parent: entryWidgetB,child: attributeWidget});
                                          }
                                      }
                                  }
                                  
                              }
                          }
                      }
                      
                      getCurrentContext().setBusy();
                  }
                  
                  console.log(searchBox,messageBox,resultPanelA,resultPanelB);
                  let input = searchBox.value;
                  getCurrentContext().setBusy(true,"COMPARE");    
                  let newCallback = callback.bind({parent: container,resultPanelA: resultPanelA,resultPanelB: resultPanelB,input: input,searchBox: searchBox,test: test});
                  getCurrentContext().CacheManager.getData({contenttype: "COMPARE",window: window,query:{ contenttype: "COMPARE",parentid: input,testname: test.testname},callback: newCallback,nocache: true});                
  
  }
  
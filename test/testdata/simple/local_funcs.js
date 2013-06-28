/*DEF*/function a/*DECLID:a*/(
  /*DEF*/b/*DEF:{path:'a.b',local:true}*//*DECLID:a.b,local*/
) {
}/*DEF:{path:'a',local:false}*/

a();/*REF:a*/

var f = /*DEF*/a/*DEF:{path:'f',local:false}*/;/*REF:a*/

var g/*DECLID:g,local*/ = /*DEF*/function(/*DEF1*/h/*DEF1:{path:'g.h',local:true}*/) {
  return h;/*REF:g.h,local*/
}/*DEF:{path:'g',local:false}*/;

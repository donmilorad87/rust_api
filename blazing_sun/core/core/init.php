<?php

$arr = array_diff(scandir(__DIR__ .'/classes'), array('..', '.','helper'));
$arr = array_values($arr);


for($j=0;$j<sizeof($arr);$j++){
require_once(__DIR__ .'/classes/'.$arr[$j]);

	}
require_once(__DIR__ .'/config/configs.php');
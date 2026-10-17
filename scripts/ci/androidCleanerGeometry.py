"""Exact native touch geometry checks; no screenshots or style assumptions."""
import re

def validate_targets(root,keys,package,minimum=72):
    result={}
    for key in keys:
        nodes=[node for node in root.iter('node') if node.get('resource-id','').split(':id/')[-1]==key and node.get('package')==package]
        assert len(nodes)==1,'Missing/ambiguous native action: '+key
        bounds=list(map(int,re.findall(r'-?\d+',nodes[0].get('bounds',''))))
        assert len(bounds)==4,'Missing native bounds: '+key
        x1,y1,x2,y2=bounds
        assert 0<=x1<x2<=480 and 0<=y1<y2<=960,'Clipped native action: '+key
        assert x2-x1>=minimum and y2-y1>=minimum,'Native action smaller than 48dp: '+key
        result[key]=bounds
    return result

def validate_disjoint(left,right):
    assert min(left[2],right[2])<=max(left[0],right[0]) or min(left[3],right[3])<=max(left[1],right[1]),'Independent native actions overlap'

"""Architectural detail pass, executed by build_scene.py before export.

Uses its geometry helpers so every addition remains editable and keeps its zone.
No new emissive details: function sculptures and the signal remain the accents.
"""
STONE=mat('Limestone foundation',(.61,.67,.74),.9)
CERAMIC=mat('Ceramic trim',(.94,.955,.975),.36)
RECESS=mat('Architectural recess',(.35,.43,.53),.86)

def parapet(x,y,w,d,z,zone):
    for sign in (-1,1):
        box('Roof edge coping',(x,y+sign*d/2,z),(w+.12,.12,.20),CERAMIC,zone,.025)
        box('Roof edge coping',(x+sign*w/2,y,z),(.12,d,.20),CERAMIC,zone,.025)

def vent(x,y,z,w,d,zone):
    box('Vent equipment foot',(x,y,z), (w+.18,d+.18,.1),STONE,zone,.025)
    box('Vent housing',(x,y,z+.20),(w,d,.32),WHITE,zone,.045)
    box('Vent recessed grille',(x,y-d/2-.014,z+.20),(w*.82,.02,.21),RECESS,zone,.012)
    for i in range(4):
        box('Vent grille louver',(x,y-d/2-.032,z+.125+i*.05),(w*.86,.035,.022),CERAMIC,zone,.008)

def stairs(x,y,w,zone):
    # Three equal rises from the terrain up to the existing 0.5 m platform.
    for i in range(3):
        h=.11*(i+1)
        box('Entrance stone tread',(x,y+i*.23,.17+h/2),(w,.26,h),PAPER,zone,.018)

def bench(x,y,zone='land'):
    for dx in (-.4,.4):box('Bench foot',(x+dx,y,.28),(.12,.3,.23),STONE,zone,.016)
    box('Bench seat',(x,y,.42),(1.12,.38,.1),CERAMIC,zone,.025)
    box('Bench back',(x,y+.17,.62),(1.12,.08,.32),WHITE,zone,.025)

def person(x,y,angle=0):
    # Sparse monochrome scale figures, 0.58 m high in this symbolic miniature.
    sphere('Scale figure head',(x,y,.69),(.065,.065,.07),PAPER)
    rod('Scale figure torso',(x,y,.36),(x,y,.59),.069,WHITE,'land')
    for sign in (-1,1):
        dx=sign*.055*math.cos(angle);dy=sign*.055*math.sin(angle)
        rod('Scale figure leg',(x+dx,y+dy,.17),(x+dx*.45,y+dy*.45,.39),.025,RECESS,'land')
        rod('Scale figure arm',(x+dx*1.5,y+dy*1.5,.38),(x+dx*.9,y+dy*.9,.55),.022,WHITE,'land')

# An inset stone foundation, a fine reveal, and a porcelain top edge.
foundation=bpy.data.objects.get('Foundation reveal')
foundation.data.materials.clear();foundation.data.materials.append(STONE)
box('Continuous base shadow reveal',(0,0,-.455),(33.84,24.84,.055),RECESS,'land',.52)
for sign in (-1,1):
    box('Long edge porcelain inlay',(0,sign*12.32,-.04),(31.8,.025,.06),CERAMIC,'land',.012)
    box('Short edge porcelain inlay',(sign*16.81,0,-.04),(.025,22.9,.06),CERAMIC,'land',.012)

# Controlled pavement seams, curbs and pedestrian crossing; leave breathing room.
for yy in (5.3,6.7):
    box('Main street curb',(0,yy,.22),(27.4,.075,.12),CERAMIC,'land',.018)
for x in range(-13,14,2):
    box('Paving joint',(x,7.05,.17),(.014,.54,.012),STONE,'land',0)
for i in range(5):
    box('Pedestrian crossing',(-5,5.52+i*.24,.18),(.75,.1,.015),CERAMIC,'land',.004)
for x,y in [(-12,-10.25),(-8,-10.25),(8.15,-.55),(11.15,-.55),(-12.4,1.9),(-8,1.9)]:
    cyl('Pavement bollard',(x,y,.37),.047,.40,STONE,'land',12)
    cyl('Bollard ceramic cap',(x,y,.58),.052,.035,CERAMIC,'land',12)
for x,y in [(-12.8,-1.2),(12.8,4.5),(.2,7.0)]:bench(x,y)
for x,y,a in [(-11,-10.65,.2),(-8.4,-10.4,.7),(-7.3,1.7,.4),(3.7,5.6,.2),(10.9,-.7,1.3),(1.2,7.0,.6),(8.6,-9.8,.3)]:person(x,y,a)

# Intake: roof parapet, recessed service door, louvred unit, entrance steps.
parapet(-10,-8.2,3.8,2.5,1.72,'import')
vent(-11.4,-7.55,1.72,.54,.48,'import')
box('Intake service door reveal',(-8.087,-8.1,1.01),(.025,.62,.83),RECESS,'import',.02)
box('Intake service door',(-8.065,-8.1,1.01),(.025,.54,.75),STONE,'import',.015)
for yy in (-9.12,-8.62,-7.62):box('Intake wall joint',(-8.092,yy,1.02),(.013,.018,1.06),STONE,'import',0)
stairs(-10,-10.77,2.7,'import')

# Pricing: vessel footings and service rack; small equipment, not extra icons.
parapet(-1,3.2,6,2,2.04,'price')
for x,h in [(-2.5,2.7),(-.65,3.45),(1.15,2.4)]:
    cyl('Vessel foundation',(x,.3,.60),.70,.18,STONE,'price')
    cyl('Vessel foundation cap',(x,.3,.72),.65,.075,CERAMIC,'price')
    cyl('Vessel crown rim',(x,.3,.49+h),.585,.07,CERAMIC,'price')
    cyl('Vessel pressure valve',(x,.3,.87+h),.11,.24,WHITE,'price',20)
    for dx in (-.51,.51):
        box('Footing anchor',(x+dx,.3,.74),(.09,.12,.07),RECESS,'price',.012)
for yy in (2.8,3.5):
    for xx in (-2.8,-1.5,-.2,1.1):
        for k in range(4):box('Existing vent louver',(xx,yy-.15+k*.1,2.264),(.5,.027,.02),STONE,'price',.005)
for x in (-3.9,2.5):
    box('Gantry anchor foot',(x,-1.1,.55),(.34,.34,.12),STONE,'price',.025)
    rod('Gantry knee brace',(x,-1.1,3.15),(x+(.6 if x<0 else -.6),-1.1,3.7),.045,WHITE,'price')
box('Plant service cabinet',(2.82,3.1,1.12),(.52,1.3,1.14),WHITE,'price',.055)
for yy in (2.85,3.34):box('Cabinet inset door',(3.089,yy,1.14),(.017,.39,.78),STONE,'price',.018)

# Inspection bridge: structural bracing below its existing walking rail.
parapet(6.6,-8.7,1.5,1.25,2.04,'risk')
for x in (5.05,7.75):
    for i in range(8):
        yy=-7.8+i*.78
        rod('Bridge diagonal brace',(x,yy,1.0),(x,yy+.70,1.37),.021,STONE,'risk')
stairs(6.5,-10.46,2.1,'risk')

# Knowledge archive: crisp slab edges and entrance framing, book kept dominant.
for z in (.6,1.4,2.2,3,3.8,4.6):
    box('Archive fine fascia',(-10.2,2.608,z),(4.05,.026,.06),CERAMIC,'knowledge',.009)
for x in (-10.69,-9.71):box('Archive entrance jamb',(x,2.565,.92),(.08,.13,.66),CERAMIC,'knowledge',.015)
box('Archive entrance lintel',(-10.2,2.565,1.25),(1.06,.13,.08),CERAMIC,'knowledge',.015)

# Report pavilion: rhythm across the otherwise blank side wall and roof vents.
for yy in (1.35,2.05,2.75,3.45):
    box('Report side recess',(12.061,yy,1.57),(.022,.48,1.29),STONE,'report',.025)
    box('Report side pilaster',(12.095,yy+.29,1.61),(.08,.07,1.76),CERAMIC,'report',.015)
box('Report side cornice',(12.08,2.6,2.52),(.12,3.28,.10),CERAMIC,'report',.02)
vent(8.3,3.35,3.21,.70,.50,'report')
vent(11.0,3.35,3.21,.70,.50,'report')

# Collaborative courtyard: workstations on plinths, understated human-scale seats.
for x,y in [(-.4,8.8),(2.2,8.8),(4.8,8.8),(-.4,10.1),(2.2,10.1),(4.8,10.1)]:
    box('Workstation base reveal',(x,y,.54),(1.7,.95,.09),STONE,'review',.055)
    box('Workstation door recess',(x,y-.433,.83),(.46,.018,.43),STONE,'review',.018)
bench(-.4,7.3,'review');bench(4.8,7.3,'review')

# Workbook screen: side ribs and ventilated rear support, no change to the grid.
for z in (1.5,3.0,4.5,6.0,7.5):
    box('Screen housing side rib',(-3.275,9.25,z),(.07,.74,.055),STONE,'table',.012)
for x in (-11.45,-3.95):
    box('Screen buttress foundation',(x,9.8,.62),(.85,1.7,.18),STONE,'table',.055)
    for z in (1.6,1.85,2.1,2.35):box('Buttress ventilation slot',(x,10.54,z),(.32,.025,.065),RECESS,'table',.015)

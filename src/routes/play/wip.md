great

next lets look at introducing logic for different conditions

this was just an excersise to test optiimisationm

- simple click
  default > ready
  mouse down > active current (green)
  mouse up > inactive all (grey)
- drag style
  mouse down > active
  mouse down & enter (drag) > active current
  mouse down & leave (drag) > active previous (orange)
  mouse up > inactive all (grey)
- toggle style
  mouse down shift > active current
  mouse down shift (different one) > active current (also)
  mouse down shift (same one) > inactive current (but leave previous active unless inactiveted)
- reset
  esc > ready all

🎯 Interaction modes & visual states
Mode Trigger Description Color
Default (ready) Initial state or after reset (ESC) Everything neutral Gray
Simple click mousedown → mouseup Activates only while pressed Green while pressed, gray on release
Drag style mousedown → move (drag) - Active on current hover

- Previous hovered turns orange
- Released → all gray Green (current), Orange (previous), Gray (inactive)
  Toggle style Shift + mousedown - Toggle active state of clicked
- Multiple can stay active
- Clicking again deactivates only that one Green (active), Gray (inactive)
  Reset ESC Resets all to default/gray Gray

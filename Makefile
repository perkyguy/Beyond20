%.js: %.pyj
	rapydscript $< --output $@

JS_FILES=src/background.js src/roll20.js src/dndbeyond.js

all: $(JS_FILES)

clean:
	rm -f $(JS_FILES) *~ */*~
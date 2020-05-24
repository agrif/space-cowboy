Clone of [seeyouspacecowboy.com](http://seeyouspacecowboy.com/) in JS
with WebGL2 and unneccessarily accurate stars.

You might need `space-lion.mp3`, `blue.mp3`,
`libera-me-from-hell.mp3`, and `exhale.mp3`. From places.

Planet textures from [Solar System Scope][sss].

 [sss]: https://www.solarsystemscope.com/textures/

Run in docker with:

    docker build -t space-cowboy .
    docker run -d -p 8080:80 space-cowboy

import { Extension } from 'tiptap'
import { Step } from 'prosemirror-transform'
import {Decoration, DecorationSet} from "prosemirror-view"
import {
  collab,
  sendableSteps,
  getVersion,
  receiveTransaction,
} from 'prosemirror-collab'

export default class Collaboration extends Extension {

  get name() {
    return 'collaboration'
  }

  init() {

    this.editor.on('init', ({ state }) => {
      // let other participants know you are here
      this.options.me.cursor = state.selection.anchor
      this.options.me.focused = state.selection.focused
      this.options.socket.emit('cursorchange', this.options.me)
    })

    this.sendUpdate = this.debounce(state => {
      const sendable = sendableSteps(state)
      this.options.me.cursor = state.selection.anchor
      this.options.me.focused = state.selection.focused


      if (sendable) {
        this.options.socket.emit('update', {
            version: sendable.version,
            steps: sendable.steps.map(step => step.toJSON()),
            clientID: this.options.clientID,
            participant: this.options.me,
          })
      } else {
        //this.options.socket.emit('cursorupdate', this.options.me)
      }
      


    }, this.options.debounce)

    this.updateLocalCursors = (state => {

      const sendable = sendableSteps(state)
      if (sendable) {

        //console.log(this.participants)
        for (var participantID in this.participants) {

          var cursor = this.participants[participantID].cursor
          if (cursor != undefined &&
              sendable.steps[0].slice != undefined &&
              cursor > sendable.steps[0].from
              ) {
                console.log(sendable.steps[0])
                console.log(sendable.steps[0].slice.content.size)
                console.log(sendable.steps[0].from)
                this.participants[participantID].cursor = cursor+sendable.steps[0].slice.content.size

                console.log(sendable.steps[0].from+' '+sendable.steps[0].slice.content.size+' '+cursor+' '+this.participants[participantID].cursor)
          }
        }
        this.options.updateCursors({participants: this.participants})
      }

    })

    this.editor.on('transaction', ({ state }) => {
      this.updateLocalCursors(state)
      console.log("cursorupdate from not sendable")

      this.sendUpdate(state)


    })
  }

  get defaultOptions() {
    return {
      me: {
        displayname: '',
      },
      socket: '',
      version: 0,
      clientID: Math.floor(Math.random() * 0xFFFFFFFF),
      debounce: 250,
      onSendable: () => {},
      update: ({ steps, version, participants }) => {
        const { state, view, schema } = this.editor

        if (getVersion(state) > version) {
          return
        }

        view.dispatch(receiveTransaction(
          state,
          steps.map(item => Step.fromJSON(schema, item.step)),
          steps.map(item => item.clientID),
        ))
      },


      updateCursors: ({ steps, version, participants }) => {
        const { state, view, schema } = this.editor
        this.participants = participants

        //Set the decorations in the editor
        var clientID = this.options.clientID
        let props = {
          decorations(state) {
            var decos = []
            for (const [id, dec] of Object.entries(participants)){
              var cursorclass = 'cursor'
              var displayname = dec.displayname
              var displaycolor = 'style="background-color:'+dec.displaycolor+'; border-top-color:'+dec.displaycolor+'"'

              const dom = document.createElement('div')
              if (dec.focused==false) {
                cursorclass += ' inactive'
              }
              
              if (dec.clientID == clientID){
                cursorclass += ' me'
              }
              if (displayname == false){
                displayname = dec.clientID
              } 

              dom.innerHTML = '<span class="'+cursorclass+'" '+displaycolor+'>'+displayname+'</span>'
              dom.style.display = 'inline'
              dom.class = 'tooltip'
              decos.push(Decoration.widget(dec.cursor-1, dom))
            }
            return DecorationSet.create(state.doc, decos);
          }
        }
        view.setProps(props)

      },
    }
  }

  get plugins() {
    return [
      collab({
        version: this.options.version,
        clientID: this.options.clientID,
      }),
    ]
  }

  debounce(fn, delay) {
    let timeout
    return function (...args) {
      if (timeout) {
        clearTimeout(timeout)
      }
      timeout = setTimeout(() => {
        fn(...args)
        timeout = null
      }, delay)
    }
  }

}
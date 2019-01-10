import React from 'react';
import ReactResizeDetector from 'react-resize-detector';

function Canvas(props) {
    let mounted = false;

    /*function onResize(width, height) {
        if(mounted) {
            props.onResize(width, height);
        }
    }*/

    function onMount(node) {
        if(node) {
            node.appendChild(props.canvas);
            props.onMount(node);
            props.onResize(node.clientWidth, node.clientHeight);
            mounted = true;
        }
        else {
            mounted = false;
        }
    }

    const forwardProps = {...props};
    delete forwardProps.onMount;
    delete forwardProps.onResize;

    return <div className='three-canvas' ref={onMount} {...forwardProps}/>;
}

Canvas.defaultProps = {
    className: '',
    onMount: function() {},
    onResize: function() {}
};

export default Canvas;